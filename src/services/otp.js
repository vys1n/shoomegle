const { otpStore} = require('./email');

function verifyOTP(email, enteredOTP) {
    try {
        const storedData = otpStore.get(email);

        if (!storedData) {
            return {
                success: false,
                message: 'No OTP found. Please request a new OTP.'
            };
        }

        const { otp, expiresAt } = storedData;

        if (Date.now() > expiresAt) {
            otpStore.delete(email); // cleanup after successful verification
            return {
                success: false,
                message: 'OTP has expired. Please request a new OTP.'
            };
        }

        if (otp === enteredOTP.toString()) {
            otpStore.delete(email);
            return {
                success: true,
                message: 'OTP verified successfully.',
                email: email
            };
        } else {
            return {
                success: false,
                message: 'Incorrect OTP. Please try again.'
            }
        }

    } catch (error) {
        console.error('Error verifying OTP: ', error);
        return {
            success: false,
            message: 'Verification failed. Please try again.'
        };
    }
}

function cleanupExpiredOTPs() {
    const now = Date.now();
    for (const [email,data] of otpStore.entries()) {
        if (now > data.expiresAt) {
            otpStore.delete(email);
        }
    }
}

setInterval(cleanupExpiredOTPs, 60000);

module.exports = { verifyOTP };
