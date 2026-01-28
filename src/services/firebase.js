const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');

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
const db = getFirestore(app);

module.exports = { db };
