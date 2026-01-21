// require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sendOTP } = require('./services/email');
const { verifyOTP } = require('./services/otp');

const app = express();
const PORT = 3000;

const path = require('path');

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve scripts folder separately
app.use('/scripts', express.static(path.join(__dirname, '../scripts')));

// Middleware
app.use(cors()); // Allow frontend to connect
app.use(express.json()); // Parse JSON bodies

// Send OTP endpoint
app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;
    const result = await sendOTP(email);
    res.json(result);
});

// Verify OTP endpoint
app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    const result = verifyOTP(email, otp);
    res.json(result);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
