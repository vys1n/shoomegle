const userVideo = document.getElementById("userVideo");
const partnerVideo = document.getElementById("partnerVideo");

let userStream;

async function startCamera() {
    try {
        userStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        userVideo.srcObject = userStream;
    } catch (error) {
        console.error("Error accessing camera: ", error);
        alert("Camera permission denied or not available.");
    }
}

startCamera();
