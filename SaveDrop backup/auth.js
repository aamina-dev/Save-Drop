// ========= FIREBASE IMPORTS =========
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ========= FIREBASE CONFIG =========
const firebaseConfig = {
  apiKey: "AIzaSyCdcE6ASFSi8ZHn82q741xUWUO1cp7tK3g",
  authDomain: "save-drop.firebaseapp.com",
  databaseURL: "https://save-drop-default-rtdb.firebaseio.com",
  projectId: "save-drop",
  storageBucket: "save-drop.firebasestorage.app",
  messagingSenderId: "1051331432686",
  appId: "1:1051331432686:web:7f97c526d655b37419e3ff"
};

// ========= INIT =========
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ========= LOGIN =========
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "index.html";
    } catch (err) {
      loginError.textContent = "❌ " + err.message;
    }
  });
}

// ========= AUTH STATE =========
onAuthStateChanged(auth, (user) => {
  // Dashboard page
  if (window.location.pathname.includes("index.html")) {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    // Show real email
    const emailEl = document.getElementById("userEmail");
    if (emailEl) emailEl.textContent = user.email;

    // LOGOUT
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        await signOut(auth);
        window.location.href = "login.html";
      };
    }

    // CHANGE PASSWORD
    const changeBtn = document.getElementById("changePasswordBtn");
    if (changeBtn) {
      changeBtn.onclick = async () => {
        const newPass = prompt("Enter new password (min 6 chars)");
        if (!newPass || newPass.length < 6) {
          alert("Password must be at least 6 characters");
          return;
        }

        try {
          await updatePassword(user, newPass);
          alert("✅ Password updated successfully");
        } catch (err) {
          if (err.code === "auth/requires-recent-login") {
            alert("⚠️ Please logout and login again, then change password.");
          } else {
            alert(err.message);
          }
        }
      };
    }
  }
});