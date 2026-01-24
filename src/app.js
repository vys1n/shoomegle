const express = require('express');
const cors = require('cors');
const path = require('path');
const { sendOTP } = require('./services/email');
const { verifyOTP } = require('./services/otp');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../public')));
app.use('/scripts', express.static(path.join(__dirname, '../scripts')));

// middleware
app.use(cors());            // allow frontend to connect
app.use(express.json());    // parse json bodies

app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;
    const result = await sendOTP(email);
    res.json(result);
});

app.post('/api/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    const result = verifyOTP(email, otp);
    res.json(result);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
