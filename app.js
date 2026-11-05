import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Firebase Web App configuration for Future Scholars Grade 8.
// These web configuration values identify the project; Firestore Security Rules
// must protect learner records. Never place Admin SDK credentials in this file.
const firebaseConfig = {
  apiKey: "AIzaSyCxW5NG6gjS23UqM_d_KuHKC_No8p_fczo",
  authDomain: "future-scholars-grade-8.firebaseapp.com",
  projectId: "future-scholars-grade-8",
  storageBucket: "future-scholars-grade-8.firebasestorage.app",
  messagingSenderId: "794312467960",
  appId: "1:794312467960:web:57701e9b2518b13904e20d",
  measurementId: "G-FCKZ2LY82C"
};

const $ = (selector) => document.querySelector(selector);
const dialog = $("#authDialog");
const registerForm = $("#registerForm");
const loginForm = $("#loginForm");
const authMessage = $("#authMessage");
const forgotPasswordButton = $("#forgotPasswordButton");
forgotPasswordButton.addEventListener("click", async () => {
  const email = $("#loginEmail").value.trim();
  if (!email) {
    showMessage("Enter your email address above, then click Forgot password?", true);
    $("#loginEmail").focus();
    return;
  }
  if (!firebaseReady || !auth) {
    showMessage("Password reset is not available right now. Please contact your administrator.", true);
    return;
  }
  forgotPasswordButton.disabled = true;
  forgotPasswordButton.textContent = "Sending reset email…";
  try {
    await sendPasswordResetEmail(auth, email);
    showMessage("If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder.");
  } catch (error) {
    const messages = {
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/user-not-found": "No account was found for that email address.",
      "auth/too-many-requests": "Too many attempts. Please wait and try again later.",
      "auth/network-request-failed": "Network error. Check your internet connection and try again."
    };
    showMessage(messages[error.code] || "We could not send the reset email. Please try again later.", true);
  } finally {
    forgotPasswordButton.disabled = false;
    forgotPasswordButton.textContent = "Forgot password?";
  }
});
let auth = null;
let db = null;
let firebaseReady = false;

try {
  firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
  if (firebaseReady) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (error) {
  console.error("Firebase setup:", error);
}

function showMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("error", isError);
}
function setMode(mode) {
  const registering = mode === "register";
  registerForm.hidden = !registering;
  loginForm.hidden = registering;
  $("#registerTab").classList.toggle("active", registering);
  $("#loginTab").classList.toggle("active", !registering);
  $("#authTitle").textContent = registering ? "Create your account" : "Welcome back";
  $("#authIntro").textContent = registering ? "Join Future Scholars Grade 8 and get ready to learn." : "Log in to continue your learning journey.";
  showMessage("");
}
function openAuth(mode) {
  setMode(mode);
  if (!dialog.open) dialog.showModal();
}
document.querySelectorAll("[data-open-auth]").forEach(button => button.addEventListener("click", () => openAuth(button.dataset.openAuth)));
document.querySelectorAll("[data-auth-tab]").forEach(button => button.addEventListener("click", () => setMode(button.dataset.authTab)));
$("#closeAuth").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
$("#menuToggle").addEventListener("click", () => {
  const nav = $("#mainNav");
  const open = nav.classList.toggle("open");
  $("#menuToggle").setAttribute("aria-expanded", String(open));
  $("#menuToggle").setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
});
document.querySelectorAll("#mainNav a").forEach(link => link.addEventListener("click", () => $("#mainNav").classList.remove("open")));
$("#year").textContent = new Date().getFullYear();

registerForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!firebaseReady) {
    showMessage("Registration is not connected yet. The administrator must finish the secure Firebase setup before learner accounts can be created.", true);
    return;
  }
  const form = new FormData(registerForm);
  const fullName = String(form.get("fullName")).trim();
  const schoolName = String(form.get("schoolName")).trim();
  const email = String(form.get("email")).trim();
  const password = String(form.get("password"));
  const submit = registerForm.querySelector("button[type=submit]");
  submit.disabled = true;
  submit.textContent = "Creating account…";
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: fullName });
    await setDoc(doc(db, "learners", credential.user.uid), {
      uid: credential.user.uid,
      fullName,
      schoolName,
      email,
      grade: 8,
      role: "learner",
      createdAt: serverTimestamp()
    });
    showMessage("Your account has been created. You can now continue to the learner area.");
    registerForm.reset();
  } catch (error) {
    const messages = {
      "auth/email-already-in-use": "This email address already has an account. Please log in.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/weak-password": "Please choose a stronger password of at least 8 characters.",
      "auth/network-request-failed": "Network error. Check your internet connection and try again."
    };
    showMessage(messages[error.code] || "We could not create your account. Please try again or contact support.", true);
  } finally {
    submit.disabled = false;
    submit.textContent = "Create learner account";
  }
});

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!firebaseReady) {
    showMessage("Login is not connected yet. The administrator must finish the secure Firebase setup first.", true);
    return;
  }
  const form = new FormData(loginForm);
  const submit = loginForm.querySelector("button[type=submit]");
  submit.disabled = true;
  submit.textContent = "Logging in…";
  try {
    const credential = await signInWithEmailAndPassword(auth, String(form.get("email")).trim(), String(form.get("password")));
    const profileSnapshot = await getDoc(doc(db, "learners", credential.user.uid));
    if (!profileSnapshot.exists()) {
      showMessage("Your account profile could not be found. Please contact the administrator.", true);
      await auth.signOut();
      return;
    }
    const profile = profileSnapshot.data();
    if (profile.role === "admin") {
      showMessage("Administrator login successful. Opening the admin dashboard…");
      window.location.href = "./admin.html";
    } else {
      showMessage("Login successful. Opening your learner dashboard…");
      window.location.href = "./learner.html";
    }
  } catch (error) {
    showMessage(error.code === "auth/invalid-credential" ? "Email or password is incorrect." : "We could not log you in. Please check your details and try again.", true);
  } finally {
    submit.disabled = false;
    submit.textContent = "Log in";
  }
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(error => console.info("Offline support unavailable:", error)));
}
