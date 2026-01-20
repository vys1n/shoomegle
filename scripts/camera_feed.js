const userVideo = document.getElementById("userVideo");
const partnerVideo = document.getElementById("partnerVideo");

let userStream;

async function startCamera() {
  try {
    userStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true // set true later for video chat
    });

    // Attach the camera stream to the video element
    userVideo.srcObject = userStream;
  } catch (err) {
    console.error("Error accessing camera:", err);
    alert("Camera permission denied or not available.");
  }
}

startCamera();
