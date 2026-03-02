// Firebase Configuration
// Real Firebase project credentials for emojipass study
// Retrieved from: Firebase Console > Project Settings > Your apps > SDK setup and configuration

const firebaseConfig = {
  apiKey: "AIzaSyAl8zxfljZa9-8v4eSepK_NFyu821h6ZzA",
  authDomain: "emojipass-39b84.firebaseapp.com",
  databaseURL: "https://emojipass-39b84-default-rtdb.firebaseio.com",
  projectId: "emojipass-39b84",
  storageBucket: "emojipass-39b84.firebasestorage.app",
  messagingSenderId: "1003261290071",
  appId: "1:1003261290071:web:0bcd9bed7ed8119d8ce512",
  measurementId: "G-MJ0196CQ9G"
};

const initializeFirebaseConnection = async () => {
  if (typeof firebase === "undefined" || !window.StorageModule) {
    console.warn("Firebase SDK or Storage module not loaded. Running in local-only mode.");
    return;
  }

  const initialized = window.StorageModule.initializeFirebase(firebaseConfig);
  if (!initialized) {
    return;
  }

  if (firebase.auth) {
    try {
      firebase.auth().onAuthStateChanged((user) => {
        if (window.StorageModule && typeof window.StorageModule.setFirebaseAuthReady === "function") {
          window.StorageModule.setFirebaseAuthReady(Boolean(user));
        }
      });

      await firebase.auth().signInAnonymously();
      if (window.StorageModule && typeof window.StorageModule.setFirebaseAuthReady === "function") {
        window.StorageModule.setFirebaseAuthReady(true);
      }
      console.log("Firebase anonymous auth ready");
    } catch (error) {
      if (error && error.code === "auth/configuration-not-found") {
        if (window.StorageModule && typeof window.StorageModule.setFirebaseAuthReady === "function") {
          window.StorageModule.setFirebaseAuthReady(false);
        }
        console.error("Firebase Anonymous Auth is disabled. Enable Authentication > Sign-in method > Anonymous in Firebase Console, then reload.");
        return;
      }

      if (window.StorageModule && typeof window.StorageModule.setFirebaseAuthReady === "function") {
        window.StorageModule.setFirebaseAuthReady(false);
      }
      console.error("Firebase anonymous auth failed:", error);
    }
  } else {
    console.warn("Firebase Auth SDK not loaded. Authenticated rules may block database writes.");
  }
};

initializeFirebaseConnection();

// Note: To enable Firebase:
// 1. Create a Firebase project at https://console.firebase.google.com/
// 2. Enable Realtime Database
// 3. Replace the config values above with your project's credentials
// 4. Set appropriate database rules for your use case
