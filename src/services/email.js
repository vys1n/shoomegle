require('dotenv').config();
const nodemailer = require('nodemailer');

// In-memory storage for OTPs and rate limiting
const otpStore = new Map(); // {email: {otp, expiresAt}}
const rateLimitStore = new Map(); // {email: lastSentAt}

// Email configuration
const transporter = nodemailer.createTransport({
  pool: true,
  maxConnections: 5,
  service: 'gmail', // or use 'smtp.gmail.com'
  auth: {
    user: process.env.EMAIL_USER, // Replace with your email
    pass: process.env.EMAIL_PASS // Replace with your app password
  }
});

// Validate university email format
function isValidUniversityEmail(email) {
  const regex = /^[a-z]+@shooliniuniversity\.com$/;
  return regex.test(email);
}

// Generate random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Check rate limit (1 OTP per 2 minutes)
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

// Send OTP email
async function sendOTP(email) {
  try {
    // Validate email format
    if (!isValidUniversityEmail(email)) {
      return { 
        success: false, 
        message: 'Invalid email format. Please use your university email (@shooliniuniversity.com)' 
      };
    }

    // Check rate limit
    const rateLimit = checkRateLimit(email);
    if (!rateLimit.allowed) {
      return { 
        success: false, 
        message: `Please wait ${rateLimit.remainingTime} seconds before requesting another OTP` 
      };
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + (2 * 60 * 1000); // 2 minutes from now

    // Store OTP with expiry
    otpStore.set(email, { otp, expiresAt });
    rateLimitStore.set(email, Date.now());

    // Send email
    const mailOptions = {
      from: 'golatopka@gmail.com',
      to: email,
      subject: 'Your OTP for Shoomegle',
      text: `Your OTP is: ${otp}\n\nThis OTP will expire in 2 minutes.\n\nDo not share this OTP with anyone.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Shoomegle - OTP Verification</h2>
          <p>Your OTP is:</p>
          <h1 style="color: #4CAF50; letter-spacing: 5px;">${otp}</h1>
          <p>This OTP will expire in <strong>2 minutes</strong>.</p>
          <p style="color: #f44336;">Do not share this OTP with anyone.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    return { 
      success: true, 
      message: 'OTP sent successfully to your email' 
    };

  } catch (error) {
    console.error('Error sending OTP:', error);
    return { 
      success: false, 
      message: 'Failed to send OTP. Please try again.' 
    };
  }
}

module.exports = { sendOTP, otpStore };
