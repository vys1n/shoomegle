import './style.css';

import { initializeApp } from "firebase/app";
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    setDoc,
    getDoc,
    updateDoc,
    onSnapshot
} from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBhqc1_lXEXjnyTwNB2RI81uc8OMZnsHYE",
    authDomain: "fir-rtc-1a0b9.firebaseapp.com",
    projectId: "fir-rtc-1a0b9",
    storageBucket: "fir-rtc-1a0b9.firebasestorage.app",
    messagingSenderId: "598334941929",
    appId: "1:598334941929:web:c22afe403a8f5af4fd5e78",
    measurementId: "G-9QT0ZXHDJ4"
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

let pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');

webcamButton.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    remoteStream = new MediaStream();

    localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
    });

    pc.ontrack = event => {
        event.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
        });
    };

    webcamVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;

    callButton.disabled = false;
    answerButton.disabled = false;
    webcamButton.disabled = true;
};

callButton.onclick = async () => {
    const callsCollection = collection(firestore, 'calls');
    const callDocRef = doc(callsCollection);

    const offerCandidatesRef = collection(callDocRef, 'offerCandidates');
    const answerCandidatesRef = collection(callDocRef, 'answerCandidates');

    callInput.value = callDocRef.id;

    pc.onicecandidate = (event) => {
        event.candidate && addDoc(offerCandidatesRef, event.candidate.toJSON());
    };

    const offerDesc = await pc.createOffer();
    await pc.setLocalDescription(offerDesc);

    const offer = {
        sdp: offerDesc.sdp,
        type: offerDesc.type
    };

    await setDoc(callDocRef, { offer });

    onSnapshot(callDocRef, (snapshot) => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
            const answerDesc = new RTCSessionDescription(data.answer);
            pc.setRemoteDescription(answerDesc);
        }
    });

    onSnapshot(answerCandidatesRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });

    hangupButton.disabled = false;
};

answerButton.onclick = async () => {
    const callId = callInput.value;
    const callDocRef = doc(firestore, 'calls', callId);
    const answerCandidatesRef = collection(callDocRef, 'answerCandidates');
    const offerCandidatesRef = collection(callDocRef, 'offerCandidates');

    pc.onicecandidate = (event) => {
        event.candidate && addDoc(answerCandidatesRef, event.candidate.toJSON());
    };

    const callSnapshot = await getDoc(callDocRef);
    const callData = callSnapshot.data();

    const offerDesc = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));

    const answerDesc = await pc.createAnswer();
    await pc.setLocalDescription(answerDesc);

    const answer = {
        type: answerDesc.type,
        sdp: answerDesc.sdp
    };

    await updateDoc(callDocRef, { answer });

    onSnapshot(offerCandidatesRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            console.log(change);
            if (change.type === 'added') {
                let data = change.doc.data();
                pc.addIceCandidate(new RTCIceCandidate(data));
            }
        });
    });

    hangupButton.disabled = false;
};

hangupButton.onclick = () => {
    pc.close();

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    localStream = null;
    remoteStream = null;
    webcamVideo.srcObject = null;
    remoteVideo.srcObject = null;

    callButton.disabled = true;
    answerButton.disabled = true;
    webcamButton.disabled = false;
    hangupButton.disabled = true;
    callInput.value = '';

    pc = new RTCPeerConnection(servers);
};
