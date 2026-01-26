import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

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
export const db = getFirestore(app);
