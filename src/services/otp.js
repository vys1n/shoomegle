const { otpStore } = require('./email');

// Verify OTP
function verifyOTP(email, enteredOTP) {
  try {
    // Check if OTP exists for this email
    const storedData = otpStore.get(email);
    
    if (!storedData) {
      return { 
        success: false, 
        message: 'No OTP found. Please request a new OTP.' 
      };
    }

    const { otp, expiresAt } = storedData;

    // Check if OTP has expired
    if (Date.now() > expiresAt) {
      otpStore.delete(email); // Clean up expired OTP
      return { 
        success: false, 
        message: 'OTP has expired. Please request a new OTP.' 
      };
    }

    // Verify OTP
    if (otp === enteredOTP.toString()) {
      otpStore.delete(email); // Clean up after successful verification
      return { 
        success: true, 
        message: 'OTP verified successfully!',
        email: email
      };
    } else {
      return { 
        success: false, 
        message: 'Incorrect OTP. Please try again.' 
      };
    }

  } catch (error) {
    console.error('Error verifying OTP:', error);
    return { 
      success: false, 
      message: 'Verification failed. Please try again.' 
    };
  }
}

// Optional: Clean up expired OTPs periodically
function cleanupExpiredOTPs() {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(email);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupExpiredOTPs, 60000);

module.exports = { verifyOTP };
