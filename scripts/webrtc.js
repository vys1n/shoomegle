import { db } from './firebase_config.js';
import {
    collection,
    addDoc,
    onSnapshot,
    getDocs,
    query,
    where,
    limit,
    doc,
    updateDoc,
    serverTimestamp,
    runTransaction,
    setDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const servers = {
    iceServers: [
        {
            urls: ['stun:stun2.l.google.com:19302', 'stun:stun1.l.google.com:19302']
        },
    ],
    iceCandidatePoolSize: 10,
};

let pc = null;
let dataChannel = null;
let localStream = null;
let remoteStream = null;
let currentCallDocId = null;
let unsubscribeList = [];

let localVideo = null;
let remoteVideo = null;

let onMessageCallBack = null;
let onStatusCallBack = null;

export function setOnMessage(callback) {
    onMessageCallBack = callback;
}

export function setOnStatus(callback) {
    onStatusCallBack = callback;
}

export function sendMessage(message) {
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(message);
        return true;
    }
    return false;
}

function setupDataChannel(channel) {
    dataChannel = channel;

    dataChannel.onopen = () => {
        console.log("Data channel is open");
    };

    dataChannel.onmessage = (event) => {
        if (onMessageCallBack) onMessageCallBack(event.data);
    };

    dataChannel.onclose = () => {
        console.log("Data channel is closed");
        if (onStatusCallBack) onStatusCallBack("Disconnected");
    };
}

export function initMedia(locStream, locVideo, remVideo) {
    localStream = locStream;
    localVideo = locVideo;
    remoteVideo = remVideo;

    localVideo.srcObject = localStream;
}

export async function startMatchmaking() {
    await hangUp();

    if (onStatusCallBack) onStatusCallBack("Looking for a random peer ... ");

    pc = new RTCPeerConnection(servers);
    remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;

    localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        });
    };

    let disconnectTimeout = null;

    pc.oniceconnectionstatechange = () => {
        console.log("ICE Connection State: ", pc.iceConnectionState);
        
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            // clear any "reconnecting" timers
            if (disconnectTimeout) {
                clearTimeout(disconnectTimeout);
                disconnectTimeout = null;
            }

            if (onStatusCallBack) onStatusCallBack("You are now chatting with a random person");
        }

        if (pc.iceConnectionState === 'disconnected') {
            if (onStatusCallBack) onStatusCallBack("Reconnecting ... Please wait");
            // wait 5 seconds
            disconnectTimeout = setTimeout(() => {
                console.log("Reconnection failed. Restart matchamking... ");
                if (onStatusCallBack) onStatusCallBack("Stranger disconnected. Looking for a new match");
                startMatchmaking();
            }, 5000);
        }

        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
            if (disconnectTimeout) clearTimeout(disconnectTimeout);
            console.log("Connection lost. Restart matchmaking ... ");
            if (onStatusCallBack) onStatusCallBack("Stranger disconnected. Looking for a new match ... ");
            startMatchmaking();
        }
    };

    try {
        console.log("Checking Firestore for waiting peers ... ");
        const q = query(collection(db, 'waiting_queue'), where('status', '==', 'waiting'), limit(20));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // filter out "zombie" rooms
            const now = Date.now();
            const validDocs = [];
            for (const d of querySnapshot.docs) {
                const createdAt = d.data().createdAt?.toMillis() || now;
                if (now - createdAt > 30000) {
                    deleteDoc(d.ref);
                } else {
                    validDocs.push(d);
                }
            }

            if (validDocs.length > 0) {
                const randIdx = Math.floor(Math.random() * validDocs.length);
                const roomDoc = validDocs[randIdx];

                console.log("Found waiting peers. Trying to join room: ", roomDoc.id);

                try {
                    await joinRoom(roomDoc);
                } catch (error) {
                    console.warn("Failed to join room (maybe taken), retrying ... ", error);
                    await startMatchmaking();
                }
            } else {
                await createRoom();
            }
        } else {
            console.log("No peers found. Creating a new room ...");
            await createRoom();
        }
    } catch (error) {
        console.error("Matchmaking failed: ", error);
    }
}

export async function hangUp() {
    unsubscribeList.forEach(unsubscribe => unsubscribe());
    unsubscribeList = [];

    if (pc) {
        pc.close();
        pc = null;
    }

    if (currentCallDocId) {
        try {
            const docRef = doc(db, 'waiting_queue', currentCallDocId);
            await deleteDoc(docRef);
        } catch (error) {
            console.warn("Cleanup error: ", error);
        }

        currentCallDocId = null;
    }
}

window.addEventListener('beforeunload', hangUp);

async function createRoom() {
    try {
        const callDocRef = doc(collection(db, 'waiting_queue'));
        const offerCandidates = collection(callDocRef, 'offerCandidates');
        const answerCandidates = collection(callDocRef, 'answerCandidates');

        currentCallDocId = callDocRef.id;

        const channel = pc.createDataChannel("chat");
        setupDataChannel(channel);

        // save ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("Generated Offer ICE Candidate");
                addDoc(offerCandidates, event.candidate.toJSON());
            }
        };

        const offerDescription = await pc.createOffer();
        await pc.setLocalDescription(offerDescription);

        const offer = {
            sdp: offerDescription.sdp,
            type: offerDescription.type,
        };

        console.log("Writing room to Firestore ...", currentCallDocId);
        await setDoc(callDocRef, {
            offer,
            status: 'waiting',
            createdAt: serverTimestamp()
        });

        console.log("Room created Successfully. Waiting for peer to connect");
        if (onStatusCallBack) onStatusCallBack("Waiting for someone to join...");

        // listen for answer
        const unsubCall = onSnapshot(callDocRef, (snapshot) => {
            const data = snapshot.data();
            if (!pc.currentRemoteDescription && data?.answer) {
                console.log("Peer joined. Connecting ... ");
                const answerDescription = new RTCSessionDescription(data.answer);
                pc.setRemoteDescription(answerDescription);
            }
        });

        unsubscribeList.push(unsubCall);

        // listen for remote ICE candidates
        const unsubCandidates = onSnapshot(answerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    pc.addIceCandidate(candidate);
                }
            });
        });

        unsubscribeList.push(unsubCandidates);
    } catch (error) {
        console.error("Error creating room: ", error);
    }
}

async function joinRoom(roomDoc) {
    const callDocRef = roomDoc.ref;
    const offerCandidates = collection(callDocRef, 'offerCandidates');
    const answerCandidates = collection(callDocRef, 'answerCandidates');
    
    pc.ondatachannel = (event) => {
        setupDataChannel(event.channel);
    };

    // claim the room
    await runTransaction(db, async (transaction) => {
        const freshDoc = await transaction.get(callDocRef);
        if (!freshDoc.exists() || freshDoc.data().status !== 'waiting') {
            throw "Room is no longer available";
        }
        transaction.update(callDocRef, { status: 'matched' });
    });

    currentCallDocId = callDocRef.id;
    console.log("Joined room successfully: ", currentCallDocId);
    if (onStatusCallBack) onStatusCallBack("Partner found. Connecting... ");

    // handle ICE
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("Generated Answer ICE Candidate");
            addDoc(answerCandidates, event.candidate.toJSON());
        }
    };

    const offerDescription = roomDoc.data().offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
        sdp: answerDescription.sdp,
        type: answerDescription.type,
    };

    await updateDoc(callDocRef, { answer });

    // listen for remote ICE candidates
    const unsubCandidates = onSnapshot(offerCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' ) {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });

    unsubscribeList.push(unsubCandidates);
}

