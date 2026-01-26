import { initMedia, startMatchmaking, hangUp } from './webrtc.js';

const userVideo = document.getElementById("userVideo");
const partnerVideo = document.getElementById("partnerVideo");
const nextBtn = document.getElementById("nextBtn");

let userStream;

async function startApp() {
    try {
        userStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        initMedia(userStream, userVideo, partnerVideo);

        console.log("Starting matchmaking...");
        await startMatchmaking();

    } catch (error) {
        console.error("Error accessing camera or starting app: ", error);
        alert("Camera permission denied or error occurred.");
    }
}

nextBtn.addEventListener('click', async () => {
    if (nextBtn.innerText === "Stop") {
        await hangUp();
        nextBtn.innerText = "Start";
        partnerVideo.srcObject = null; // clear remote video
    } else {
        nextBtn.innerText = "Stop";
        await startMatchmaking();
    }
});

startApp();
