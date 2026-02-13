import { initMedia, startMatchmaking, hangUp, sendMessage, setOnMessage, setOnStatus } from './webrtc.js';

const userVideo = document.getElementById("userVideo");
const partnerVideo = document.getElementById("partnerVideo");
const nextBtn = document.getElementById("nextBtn");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

let userStream;

// if (!sessionStorage.getItem('userEmail')) {
//     window.location.href = "/index.html";
// }

function appendMessage(label, text, type = 'normal') {
    // main container for the message line
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');
    
    if (type === 'system') {
        msgDiv.classList.add('system-msg');
        msgDiv.innerText = text;
    } else {
        const labelSpan = document.createElement('span');
        labelSpan.classList.add('message-label');
        labelSpan.classList.add(label === 'You' ? 'you-label' : 'stranger-label');
        labelSpan.innerText = `${label}: `;
        
        // actual message text
        const textSpan = document.createElement('span');
        textSpan.innerText = text;
        
        msgDiv.appendChild(labelSpan);
        msgDiv.appendChild(textSpan);
    }
    
    // append to chat history box
    chatMessages.appendChild(msgDiv);
    // auto-scroll (show latest message on top)
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

const statusText = document.querySelector(".status-container p");

function updateStatus(text) {
    statusText.innerText = text;
}

async function startApp() {
    try {
        updateStatus("Requesting camera access...");
        userStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        initMedia(userStream, userVideo, partnerVideo);

        setOnMessage((text) => {
            appendMessage('Stranger', text);
        });

        setOnStatus((status) => {
            updateStatus(status);
        });

        console.log("Starting matchmaking...");
        await startMatchmaking();

    } catch (error) {
        console.error("Error accessing camera or starting app: ", error);
        updateStatus("Error: Camera access denied. Please allow permissions.");
        alert("Camera permission denied or error occurred.");
    }
}

// rate-limiting
let messageCount = 0;
let lastReset = Date.now();

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();

        const now = Date.now();
        if (now - lastReset > 1000) {
            messageCount = 0;
            lastReset = now;
        }

        if (messageCount >= 5) {
            updateStatus("Warning: Too many messages. Please slow down.");
            return;
        }

        const text = chatInput.value.trim();
        if (text) {
            if (sendMessage(text)) {
                messageCount++;
                appendMessage('You', text);
                chatInput.value = '';
                if (statusText.innerText.includes("Too many messages")) {
                    updateStatus("You are now chatting with a random person.");
                }
            }
        }
    }
});

nextBtn.addEventListener('click', async () => {
    chatMessages.innerHTML = '';
    const isRunning = nextBtn.getAttribute('data-state') === 'running';

    if (isRunning) {
        await hangUp();
        nextBtn.innerText = "Start";
        nextBtn.setAttribute('data-state', 'stopped');
        partnerVideo.srcObject = null;
        updateStatus("Stopped. Press Start to find a partner.");
    } else {
        nextBtn.innerText = "Stop";
        nextBtn.setAttribute('data-state', 'running');
        await startMatchmaking();
    }
});

startApp();
