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
    deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

let pc = null;
let localStream = null;
let remoteStream = null;
let currentCallDocId = null;
let unsubscribeSnapshot = null;

// DOM Elements (passed from main)
let localVideoEl = null;
let remoteVideoEl = null;

export function initMedia(lStream, lVideo, rVideo) {
    localStream = lStream;
    localVideoEl = lVideo;
    remoteVideoEl = rVideo;
    
    // Set local video immediately
    localVideoEl.srcObject = localStream;
}

export async function startMatchmaking() {
    // Reset previous connection if any
    await hangUp();

    pc = new RTCPeerConnection(servers);
    remoteStream = new MediaStream();
    remoteVideoEl.srcObject = remoteStream;

    // Push tracks
    localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
    });

    // Pull tracks
    pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        });
    };

    // 1. Search for a waiting peer
    const q = query(collection(db, 'waiting_queue'), where('status', '==', 'waiting'), limit(1));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        // CASE A: Someone is waiting. Try to join them.
        const roomDoc = querySnapshot.docs[0];
        console.log("Found a waiting peer:", roomDoc.id);
        
        try {
            await joinRoom(roomDoc);
        } catch (err) {
            console.warn("Failed to join room (maybe taken), retrying...", err);
            startMatchmaking(); // Retry
        }

    } else {
        // CASE B: No one waiting. Create a room.
        console.log("No peers found. creating a room...");
        await createRoom();
    }
}

async function createRoom() {
    const callDocRef = doc(collection(db, 'waiting_queue'));
    const offerCandidates = collection(callDocRef, 'offerCandidates');
    const answerCandidates = collection(callDocRef, 'answerCandidates');

    currentCallDocId = callDocRef.id;

    // Save ICE candidates
    pc.onicecandidate = (event) => {
        event.candidate && addDoc(offerCandidates, event.candidate.toJSON());
    };

    // Create Offer
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
    };

    // Write to Firestore
    await setDoc(callDocRef, {
        offer,
        status: 'waiting',
        createdAt: serverTimestamp()
    }); // We need setDoc here, will import it dynamically or fix imports

    // Listen for answer
    unsubscribeSnapshot = onSnapshot(callDocRef, (snapshot) => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
            const answerDescription = new RTCSessionDescription(data.answer);
            pc.setRemoteDescription(answerDescription);
        }
    });

    // Listen for remote ICE candidates
    onSnapshot(answerCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });
}

// Helper to fix the missing import in createRoom without rewriting whole file yet
import { setDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";


async function joinRoom(roomDoc) {
    const callDocRef = roomDoc.ref;
    const answerCandidates = collection(callDocRef, 'answerCandidates');
    const offerCandidates = collection(callDocRef, 'offerCandidates');

    // Transaction to safely "claim" the room
    await runTransaction(db, async (transaction) => {
        const freshDoc = await transaction.get(callDocRef);
        if (!freshDoc.exists() || freshDoc.data().status !== 'waiting') {
            throw "Room is no longer available";
        }
        transaction.update(callDocRef, { status: 'matched' });
    });

    currentCallDocId = callDocRef.id;

    // Handle ICE
    pc.onicecandidate = (event) => {
        event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
    };

    const offerDescription = roomDoc.data().offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
    };

    await updateDoc(callDocRef, { answer });

    // Listen for remote ICE candidates
    onSnapshot(offerCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });
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

    // Optional: Cleanup the document if we were the host and nobody joined
    // Or if we just want to leave.
    // For simplicity in Omegle-clone, we usually just disconnect.
    // Ideally, we should delete the doc if we were 'waiting'.
    
    if (currentCallDocId) {
        // Best effort cleanup
        // const docRef = doc(db, 'waiting_queue', currentCallDocId);
        // deleteDoc(docRef).catch(e => {}); 
        currentCallDocId = null;
    }
}
