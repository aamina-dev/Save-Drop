// ========= FIREBASE IMPORTS =========
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
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

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

//  Helpers 
function setLoading(btnId, spinnerId, textId, loading) {
  const btn  = document.getElementById(btnId);
  const spin = document.getElementById(spinnerId);
  const txt  = document.getElementById(textId);
  if (!btn) return;
  btn.disabled = loading;
  if (spin) spin.classList.toggle("hidden", !loading);
  if (txt)  txt.style.opacity = loading ? "0" : "1";
}

function showError(id, msg)   { const el = document.getElementById(id); if (el) { el.textContent = msg; el.style.display = msg ? "block" : "none"; } }
function showSuccess(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.style.display = msg ? "block" : "none"; } }
function clearMsgs(...ids)    { ids.forEach(id => { const el = document.getElementById(id); if (el) { el.textContent = ""; el.style.display = "none"; } }); }

//  LOGIN 
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsgs("loginError");
    const email    = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    setLoading("loginBtn", "loginSpinner", "loginBtnText", true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "index.html";
    } catch (err) {
      const msg = friendlyError(err.code);
      showError("loginError", " " + msg);
      setLoading("loginBtn", "loginSpinner", "loginBtnText", false);
    }
  });
}

//  SIGN UP 
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsgs("signupError", "signupSuccess");
    const email    = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const confirm  = document.getElementById("signupConfirm").value;

    if (password !== confirm) {
      showError("signupError", " Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      showError("signupError", " Password must be at least 6 characters.");
      return;
    }

    setLoading("signupBtn", "signupSpinner", "signupBtnText", true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      showSuccess("signupSuccess", " Account created! Redirecting");
      setTimeout(() => { window.location.href = "index.html"; }, 1500);
    } catch (err) {
      showError("signupError", " " + friendlyError(err.code));
      setLoading("signupBtn", "signupSpinner", "signupBtnText", false);
    }
  });
}

//  FORGOT PASSWORD 
const forgotForm = document.getElementById("forgotForm");
if (forgotForm) {
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsgs("forgotError", "forgotSuccess");
    const email = document.getElementById("forgotEmail").value.trim();
    setLoading("forgotBtn", "forgotSpinner", "forgotBtnText", true);
    try {
      await sendPasswordResetEmail(auth, email);
      showSuccess("forgotSuccess", " Reset link sent! Check your inbox.");
      document.getElementById("forgotEmail").value = "";
    } catch (err) {
      showError("forgotError", " " + friendlyError(err.code));
    }
    setLoading("forgotBtn", "forgotSpinner", "forgotBtnText", false);
  });
}

//  AUTH STATE 
onAuthStateChanged(auth, (user) => {
  const path = window.location.pathname;
  const onDash  = path.includes("index.html") || path.endsWith("/") || path.endsWith("\\");
  const onLogin = path.includes("login.html");

  if (onDash) {
    if (!user) { window.location.href = "login.html"; return; }

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
        const newPass = prompt("Enter new password (min 6 chars):");
        if (!newPass || newPass.length < 6) { alert("Password must be at least 6 characters."); return; }
        try {
          await updatePassword(user, newPass);
          alert(" Password updated successfully.");
        } catch (err) {
          if (err.code === "auth/requires-recent-login") alert(" Please sign out and sign in again, then retry.");
          else alert(err.message);
        }
      };
    }
  }

  if (onLogin && user) {
    window.location.href = "index.html";
  }
});

//  Friendly error messages 
function friendlyError(code) {
  const map = {
    "auth/invalid-email":            "Invalid email address.",
    "auth/user-not-found":           "No account found with this email.",
    "auth/wrong-password":           "Incorrect password.",
    "auth/email-already-in-use":     "This email is already registered.",
    "auth/weak-password":            "Password is too weak.",
    "auth/too-many-requests":        "Too many attempts. Try again later.",
    "auth/network-request-failed":   "Network error. Check your connection.",
    "auth/invalid-credential":       "Invalid credentials. Check email & password.",
  };
  return map[code] || "Something went wrong. Please try again.";
}
