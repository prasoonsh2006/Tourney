// Paste your Firebase Project configuration here
const firebaseConfig = {

    apiKey: "AIzaSyCFA20hwEGRGXeiX0LrPKhc-VL5K4umGv0",

    authDomain: "souls-of-soulcity.firebaseapp.com",

    projectId: "souls-of-soulcity",

    storageBucket: "souls-of-soulcity.firebasestorage.app",

    messagingSenderId: "402427120355",

    appId: "1:402427120355:web:f0fa030a0a9034198213d6"

};



// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        // Use Firebase to sign in with email and password
        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Login successful!
                console.log("User logged in:", userCredential.user);
                // Redirect to the auction page
                window.location.href = 'auction.html';
            })
            .catch((error) => {
                // Login failed
                alert("Login failed: " + error.message);
                console.error("Login error:", error);
            });
    });
});