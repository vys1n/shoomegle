const emailForm = document.getElementById('email-form');
const otpForm = document.getElementById('otp-form');
const userEmail = document.getElementById('user-email');

emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = userEmail.value;
    const btn = emailForm.querySelector('button[type="submit"]');
    
    // Disable button and show loading state
    btn.disabled = true;
    btn.innerText = "Sending...";
    
    try {
        const response = await fetch('http://localhost:3000/api/send-otp', {
            method: 'POST',
            body: JSON.stringify({ email: email }),
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Swap forms on success
            emailForm.style.display = 'none';
            otpForm.style.display = 'block';
        } else {
            // Show error message
            alert(data.message);
            btn.innerText = "Get OTP";
            btn.disabled = false;
        }
        
    } catch (error) {
        alert("Something went wrong. Please try again.");
        btn.innerText = "Get OTP";
        btn.disabled = false;
    }
});

otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const otpValue = document.getElementById('otp-code').value;
    const email = userEmail.value;
    const btn = otpForm.querySelector('button[type="submit"]');
    
    // Disable button and show loading state
    btn.disabled = true;
    btn.innerText = "Verifying...";
    
    try {
        const response = await fetch('http://localhost:3000/api/verify-otp', {
            method: 'POST',
            body: JSON.stringify({ email: email, otp: otpValue }),
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Store email in session storage for chat page
            sessionStorage.setItem('userEmail', email);
            // Redirect to chat
            window.location.href = "chat.html";
        } else {
            // Show error message
            alert(data.message);
            btn.innerText = "Verify OTP";
            btn.disabled = false;
        }
        
    } catch (error) {
        alert("Something went wrong. Please try again.");
        btn.innerText = "Verify OTP";
        btn.disabled = false;
    }
});
