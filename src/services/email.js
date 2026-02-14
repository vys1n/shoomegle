require('dotenv').config();
const nodemailer = require('nodemailer');

const otpStore = new Map();         // { email : { otp, expiresAt }}
const rateLimitStore = new Map();   // { email: lastSentAt }

const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY
    },
    pool: true,
    maxConnections: 5,
});

function isValidEmail(email) {
    const regex = /^[a-z]+@shooliniuniversity\.com$/;
    return regex.test(email);
}

function genereateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function checkRateLimit(email) {
    const lastSent = rateLimitStore.get(email);
    if (lastSent) {
        const timeDiff = Date.now() - lastSent;
        const twoMinutes = 2 * 60 * 1000;
        if (timeDiff < twoMinutes) {
            const remainingTime = Math.ceil((twoMinutes - timeDiff) / 1000);
            return { allowed: false, remainingTime };
        }
    }
    return { allowed: true };
}

async function sendOTP(email){
    try {
        if (!isValidEmail(email)) {
            return {
                success: false,
                message: 'Invalid email format. Please use your university email (yourfullname@shooliniuniversity.com)'
            };
        }

        const rateLimit = checkRateLimit(email);
        if (!rateLimit.allowed) {
            return {
                success: false,
                message: `Please wait ${rateLimit.remainingTime} seconds before requesting another OTP`
            };
        }

        const otp = genereateOTP();
        const expiresAt = Date.now() + (2 * 60 * 1000);  // 2 mins from now

        otpStore.set(email, { otp, expiresAt });
        rateLimitStore.set(email, Date.now());

        const mailOptions = {
            from: 'Shoomegle <onboarding@resend.dev>',
            to: email,
            subject: 'Your OTP for Shoomegle',
            text: `Your OTP is: ${otp}\n\nThis OTP will expire in 2 minutes.\n\nDo not share this OTP.`,
            html: `
                <div style="font-family:Arial, sans-serif; padding: 20px;">
                    <h2> Shoomegle - OTP Verification </h2>
                    <p> Your OTP is: </p>
                    <h1 style="color: #4CAF50; letter-spacing: 5px;"> ${otp} </h1>
                    <p> This OTP will expire in <strong> 2 minutes </strong> </p>
                    <p style="color: #f44336"> Do not share this OTP </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        
        return {
            success: true,
            message: 'OTP sent successfully to your email.'
        };

    } catch (error) {
        console.error('Error sending OTP: ', error);
        return {
            success: false,
            message: 'Failed to send OTP. Please try again.'
        };
    }
}

module.exports = { sendOTP, otpStore };

