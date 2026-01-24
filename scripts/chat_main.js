import { initMedia, startMatchmaking, hangUp } from './webrtc_manager.js';

const userVideo = document.getElementById("userVideo");
const partnerVideo = document.getElementById("partnerVideo");
const nextBtn = document.getElementById("nextBtn");

let userStream;

async function startApp() {
    try {
        // 1. Get Camera
        userStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        // 2. Initialize WebRTC Logic
        initMedia(userStream, userVideo, partnerVideo);

        // 3. Start Matching immediately
        console.log("Starting matchmaking...");
        await startMatchmaking();

    } catch (error) {
        console.error("Error accessing camera or starting app: ", error);
        alert("Camera permission denied or error occurred.");
    }
}

// Handle "Stop" / "Next" button
nextBtn.addEventListener('click', async () => {
    if (nextBtn.innerText === "Stop") {
        await hangUp();
        nextBtn.innerText = "Start";
        partnerVideo.srcObject = null; // Clear remote video
    } else {
        nextBtn.innerText = "Stop";
        await startMatchmaking();
    }
});

// Start everything
startApp();
