const emailForm = document.getElementById('email-form');
const otpForm = document.getElementById('otp-form');
const userEmail = document.getElementById('user-email');

emailForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevents the page from refreshing

    const email = userEmail.value;

    // 1. Show a 'loading' state on the button
    const btn = document.getElementById('get-otp-btn');
    btn.innerText = "Sending...";
    btn.disabled = true;

    try {
        // 2. Call your backend (Replace with your actual API URL)
        // const response = await fetch('YOUR_BACKEND_URL/send-otp', {
        //     method: 'POST',
        //     body: JSON.stringify({ email: email }),
        //     headers: { 'Content-Type': 'application/json' }
        // });

        // 3. Logic to swap UI (Assuming backend success)
        emailForm.style.display = 'none';
        otpForm.style.display = 'block';

    } catch (error) {
        alert("Something went wrong. Please try again.");
        btn.innerText = "Get OTP";
        btn.disabled = false;
    }
});

otpForm.addEventListener('submit', (e) => {
    e.preventDefault(); // This stops the page from refreshing!

    const otpValue = document.getElementById('otp-code').value;
    
    // For now, let's just log it to the console to prove it works
    //console.log("Verifying OTP:", otpValue);

    // This is where you would eventually check the code and 
    // redirect the user to the chat room.
    //alert("OTP Entered: " + otpValue + ". Redirecting to chat...");

    // Redirect to chat page (Replace with actual chat page URL)
    window.location.href = "chat.html";
});