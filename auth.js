// =========================================================================
// AUTH.JS: Manages everything related to User Security & Logging in.
// This uses Firebase Authentication (Email & Password).
// =========================================================================

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

/* --------------------------------------------------------------------------
   1. FIREBASE SETUP
   These are the keys that connect this webpage to your specific Firebase cloud.
-------------------------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyCdcE6ASFSi8ZHn82q741xUWUO1cp7tK3g",
  authDomain: "save-drop.firebaseapp.com",
  databaseURL: "https://save-drop-default-rtdb.firebaseio.com",
  projectId: "save-drop",
  storageBucket: "save-drop.firebasestorage.app",
  messagingSenderId: "1051331432686",
  appId: "1:1051331432686:web:7f97c526d655b37419e3ff"
};

// Start Firebase and activate the Authentication module
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);


/* --------------------------------------------------------------------------
   UI HELPER FUNCTIONS
   These small functions just change the loading spinners and error text
   so the user knows the website is "thinking".
-------------------------------------------------------------------------- */
function setLoading(btnId, spinnerId, textId, loading) {
  const btn  = document.getElementById(btnId);
  const spin = document.getElementById(spinnerId);
  const txt  = document.getElementById(textId);
  if (!btn) return;
  btn.disabled = loading; // Disable button so they can't click it twice
  if (spin) spin.classList.toggle("hidden", !loading); // Show circular spinner
  if (txt)  txt.style.opacity = loading ? "0" : "1";   // Hide text
}

function showError(id, msg)   { const el = document.getElementById(id); if (el) { el.textContent = msg; el.style.display = msg ? "block" : "none"; } }
function showSuccess(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.style.display = msg ? "block" : "none"; } }
function clearMsgs(...ids)    { ids.forEach(id => { const el = document.getElementById(id); if (el) { el.textContent = ""; el.style.display = "none"; } }); }


/* --------------------------------------------------------------------------
   2. LOGIN FUNCTIONALITY
   Runs when the user clicks "Sign In" on the login.html page.
-------------------------------------------------------------------------- */
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // Stop page from refreshing
    clearMsgs("loginError");
    
    // Grab the typed email and password
    const email    = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    
    setLoading("loginBtn", "loginSpinner", "loginBtnText", true);
    
    try {
      // Send credentials over the internet to Firebase. Wait for the response.
      await signInWithEmailAndPassword(auth, email, password);
      // Success! Move them to the actual dashboard.
      window.location.href = "index.html";
    } catch (err) {
      // Failed! (Wrong password, fake email, etc.)
      const msg = friendlyError(err.code);
      showError("loginError", " " + msg);
      setLoading("loginBtn", "loginSpinner", "loginBtnText", false);
    }
  });
}


/* --------------------------------------------------------------------------
   3. SIGN UP FUNCTIONALITY
   (Note: We removed the UI for this in login.html so random people can't 
   join, but the javascript logic stays here just in case you ever want it back).
-------------------------------------------------------------------------- */
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
      // Tell Firebase to create a brand new account
      await createUserWithEmailAndPassword(auth, email, password);
      showSuccess("signupSuccess", " Account created! Redirecting");
      setTimeout(() => { window.location.href = "index.html"; }, 1500);
    } catch (err) {
      showError("signupError", " " + friendlyError(err.code));
      setLoading("signupBtn", "signupSpinner", "signupBtnText", false);
    }
  });
}


/* --------------------------------------------------------------------------
   4. FORGOT PASSWORD FUNCTIONALITY
   Sends a reset link to the user's email if they click 'Forgot Password'.
-------------------------------------------------------------------------- */
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


/* --------------------------------------------------------------------------
   5. SECURITY "BOUNCER" (AUTH STATE CHANGED)
   This is the security guard of the website. It runs constantly. If it sees
   someone trying to look at index.html without a valid login token, it instantly
   kicks them out back to login.html.
-------------------------------------------------------------------------- */
onAuthStateChanged(auth, (user) => {
  const path = window.location.pathname;
  const onDash  = path.includes("index.html") || path.endsWith("/") || path.endsWith("\\");
  const onLogin = path.includes("login.html");

  if (onDash) {
    // If they are on the Dashboard but NOT logged in -> Kick them out!
    if (!user) { window.location.href = "login.html"; return; }

    // If they are logged in, replace the "Loading..." text with their actual email
    const emailEl = document.getElementById("userEmail");
    if (emailEl) emailEl.textContent = user.email;

    // LOGOUT BUTTON
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        await signOut(auth); // Tell Firebase we left
        window.location.href = "login.html"; // Send back to login screen
      };
    }

    // CHANGE PASSWORD BUTTON
    const changeBtn = document.getElementById("changePasswordBtn");
    if (changeBtn) {
      changeBtn.onclick = async () => {
        const newPass = prompt("Enter new password (min 6 chars):");
        if (!newPass || newPass.length < 6) { alert("Password must be at least 6 characters."); return; }
        try {
          await updatePassword(user, newPass);
          alert(" Password updated successfully.");
        } catch (err) {
          // If they haven't logged in recently, Firebase blocks password changes for security.
          if (err.code === "auth/requires-recent-login") alert(" Please sign out and sign in again, then retry.");
          else alert(err.message);
        }
      };
    }
  }

  if (onLogin && user) {
    // If they are ON the login screen but they already logged in recently, 
    // automatically skip the login screen and jump to the dashboard.
    window.location.href = "index.html";
  }
});


/* --------------------------------------------------------------------------
   6. ERROR TRANSLATOR
   Firebase returns ugly error codes like 'auth/user-not-found'. This function 
   translates them into nice, human-readable English for the user interface.
-------------------------------------------------------------------------- */
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
  // If the secret code isn't in our list, just show a generic error.
  return map[code] || "Something went wrong. Please try again.";
}
