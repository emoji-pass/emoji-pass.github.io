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

// Initialize Firebase when the module is loaded (if Firebase SDK is available)
if (typeof firebase !== "undefined" && window.StorageModule) {
  window.StorageModule.initializeFirebase(firebaseConfig);
} else {
  console.warn("Firebase SDK or Storage module not loaded. Running in local-only mode.");
}

// Note: To enable Firebase:
// 1. Create a Firebase project at https://console.firebase.google.com/
// 2. Enable Realtime Database
// 3. Replace the config values above with your project's credentials
// 4. Set appropriate database rules for your use case
