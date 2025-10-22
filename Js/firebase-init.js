// firebase-init.js
const firebaseConfig = {
    apiKey: "AIzaSyCFA20hwEGRGXeiX0LrPKhc-VL5K4umGv0", // Your actual key
    authDomain: "souls-of-soulcity.firebaseapp.com",
    projectId: "souls-of-soulcity",
    storageBucket: "souls-of-soulcity.firebasestorage.app",
    messagingSenderId: "402427120355",
    appId: "1:402427120355:web:f0fa030a0a9034198213d6"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();