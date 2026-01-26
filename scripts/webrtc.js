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
let localStream = null;
let remoteStream = null;
let currentCallDocId = null;
let unsubscribeSnapshot = null;

let localVideo = null;
let remoteVideo = null;

export function initMedia(locStream, locVideo, remVideo) {
    localStream = locStream;
    localVideo = locVideo;
    remoteVideo = remVideo;

    localVideo.srcObject = localStream;
}

export async function startMatchmaking() {
    await hangUp();

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

    try {
        console.log("Checking Firestore for waiting peers ... ");
        const q = query(collection(db, 'waiting_queue'), where('status', '==', 'waiting'), limit(20));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const randIdx = Math.floor(Math.random() * querySnapshot.docs.length);
            const roomDoc = querySnapshot.docs[randIdx];

            console.log("Found waiting peers. Trying to join room: ", roomDoc.id);

            try {
                await joinRoom(roomDoc);
            } catch (error) {
                console.warn("Failed to jpin room (maybe taken), retrying ... ", error);
                await startMatchmaking();
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
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
    }

    if (pc) {
        pc.close();
        pc = null;
    }

    if (currentCallDocId) {
        try {
            const docRef = doc(db, 'waiting_queue', currentCallDocId);
            await deleteDoc(docRef);
        } catch (error) {
            console.warn ("Cleanup error: ", error);
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
        console.log("Room created successfully. Waiting for peer to connect ... ");

        // listen for answer
        unsubscribeSnapshot = onSnapshot(callDocRef, (snapshot) => {
            const data = snapshot.data();
            if (!pc.currentRemoteDescription && data?.answer) {
                console.log("Peer joined. Connecting ... ");
                const answerDescription = new RTCSessionDescription(data.answer);
                pc.setRemoteDescription(answerDescription);
            }
        });

        // listen for remote ICE candidates
        onSnapshot(answerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    pc.addIceCandidate(candidate);
                }
            });
        });
    } catch (error) {
        console.error("Error creating room: ", error);
    }
}

async function joinRoom(roomDoc) {
    const callDocRef = roomDoc.ref;
    const offerCandidates = collection(callDocRef, 'offerCandidates');
    const answerCandidates = collection(callDocRef, 'answerCandidates');

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
    onSnapshot(offerCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });
}

