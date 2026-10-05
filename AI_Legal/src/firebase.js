import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBT3y9HrxkIgKXI4-cZwl5cAPLHxLGnqyU",
    authDomain: "ai-legal-assistant-7875a.firebaseapp.com",
    projectId: "ai-legal-assistant-7875a",
    storageBucket: "ai-legal-assistant-7875a.firebasestorage.app",
    messagingSenderId: "963355678994",
    appId: "1:963355678994:web:d97601ad864d25ed3bbbcb"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export default app;