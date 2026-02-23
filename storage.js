// Storage module with Firebase + LocalStorage fallback
// Handles user registration data with hybrid cloud/local storage

// ============================================================================
// CONFIGURATION
// ============================================================================

const STORAGE_CONFIG = {
  LOCAL_KEY: "hcs_emoji_auth",
  ADMIN_STORAGE_MODE_KEY: "hcs_admin_storage_mode", // "local" | "firebase" | "hybrid"
  FIREBASE_DB_PATH: "users", // Path in Firebase Realtime Database
};

// Admin can set storage mode: "local", "firebase", or "hybrid"
// Default is "hybrid" for experiments (tries Firebase, falls back to Local)
const getStorageMode = () => {
  const mode = localStorage.getItem(STORAGE_CONFIG.ADMIN_STORAGE_MODE_KEY);
  return mode || "hybrid"; // Default to hybrid
};

const setStorageMode = (mode) => {
  if (!["local", "firebase", "hybrid"].includes(mode)) {
    console.error("Invalid storage mode. Use 'local', 'firebase', or 'hybrid'");
    return false;
  }
  localStorage.setItem(STORAGE_CONFIG.ADMIN_STORAGE_MODE_KEY, mode);
  return true;
};

const isFirebaseEnabled = () => {
  const mode = getStorageMode();
  return mode === "firebase" || mode === "hybrid";
};

// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================

let firebaseInitialized = false;
let firebaseDatabase = null;

// Check if Firebase SDK is loaded
const isFirebaseAvailable = () => {
  return typeof firebase !== "undefined" && firebase.database;
};

// Initialize Firebase (call this after Firebase SDK is loaded)
const initializeFirebase = (config) => {
  if (!isFirebaseAvailable()) {
    console.warn("Firebase SDK not loaded. Running in local-only mode.");
    return false;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    firebaseDatabase = firebase.database();
    firebaseInitialized = true;
    console.log("Firebase initialized successfully");
    return true;
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    firebaseInitialized = false;
    return false;
  }
};

// ============================================================================
// LOCAL STORAGE FUNCTIONS
// ============================================================================

const localSaveUser = (userObj) => {
  try {
    localStorage.setItem(STORAGE_CONFIG.LOCAL_KEY, JSON.stringify(userObj));
    return { success: true };
  } catch (error) {
    console.error("LocalStorage save failed:", error);
    return { success: false, error: error.message };
  }
};

const localGetUser = (participantId) => {
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG.LOCAL_KEY);
    if (!raw) return { success: false, error: "No user found" };
    
    const userData = JSON.parse(raw);
    
    // If participantId is provided, verify it matches (for future multi-user support)
    if (participantId && userData.participant_id !== participantId) {
      return { success: false, error: "User not found" };
    }
    
    return { success: true, data: userData };
  } catch (error) {
    console.error("LocalStorage read failed:", error);
    return { success: false, error: error.message };
  }
};

const localDeleteUser = (participantId) => {
  try {
    localStorage.removeItem(STORAGE_CONFIG.LOCAL_KEY);
    return { success: true };
  } catch (error) {
    console.error("LocalStorage delete failed:", error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// FIREBASE FUNCTIONS
// ============================================================================

const fbSaveUser = async (userObj) => {
  if (!firebaseInitialized || !firebaseDatabase) {
    return { success: false, error: "Firebase not initialized" };
  }

  try {
    const participantId = userObj.participant_id;
    if (!participantId) {
      return { success: false, error: "Participant ID required" };
    }

    // Store user data under /users/{participantId}
    const userRef = firebaseDatabase.ref(`${STORAGE_CONFIG.FIREBASE_DB_PATH}/${participantId}`);
    
    // Add server timestamp
    const dataToSave = {
      ...userObj,
      updated_at: firebase.database.ServerValue.TIMESTAMP,
    };

    await userRef.set(dataToSave);
    console.log(`User ${participantId} saved to Firebase`);
    return { success: true };
  } catch (error) {
    console.error("Firebase save failed:", error);
    return { success: false, error: error.message };
  }
};

const fbGetUser = async (participantId) => {
  if (!firebaseInitialized || !firebaseDatabase) {
    return { success: false, error: "Firebase not initialized" };
  }

  try {
    if (!participantId) {
      return { success: false, error: "Participant ID required" };
    }

    const userRef = firebaseDatabase.ref(`${STORAGE_CONFIG.FIREBASE_DB_PATH}/${participantId}`);
    const snapshot = await userRef.once("value");
    
    if (!snapshot.exists()) {
      return { success: false, error: "User not found" };
    }

    const userData = snapshot.val();
    console.log(`User ${participantId} retrieved from Firebase`);
    return { success: true, data: userData };
  } catch (error) {
    console.error("Firebase read failed:", error);
    return { success: false, error: error.message };
  }
};

const fbDeleteUser = async (participantId) => {
  if (!firebaseInitialized || !firebaseDatabase) {
    return { success: false, error: "Firebase not initialized" };
  }

  try {
    if (!participantId) {
      return { success: false, error: "Participant ID required" };
    }

    const userRef = firebaseDatabase.ref(`${STORAGE_CONFIG.FIREBASE_DB_PATH}/${participantId}`);
    await userRef.remove();
    console.log(`User ${participantId} deleted from Firebase`);
    return { success: true };
  } catch (error) {
    console.error("Firebase delete failed:", error);
    return { success: false, error: error.message };
  }
};

// Record login attempt (optional analytics)
const fbRecordLoginAttempt = async (participantId, success, timestamp = null) => {
  if (!firebaseInitialized || !firebaseDatabase) {
    return { success: false, error: "Firebase not initialized" };
  }

  try {
    if (!participantId) {
      return { success: false, error: "Participant ID required" };
    }

    const attemptRef = firebaseDatabase.ref(
      `${STORAGE_CONFIG.FIREBASE_DB_PATH}/${participantId}/login_attempts`
    );
    
    await attemptRef.push({
      success: success,
      timestamp: timestamp || firebase.database.ServerValue.TIMESTAMP,
    });

    return { success: true };
  } catch (error) {
    console.error("Firebase login attempt recording failed:", error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// HYBRID WRAPPER FUNCTIONS (Public API)
// ============================================================================

/**
 * Save user registration data
 * Behavior based on storage mode:
 * - "local": Save only to LocalStorage
 * - "firebase": Save only to Firebase (fallback to Local if Firebase fails)
 * - "hybrid": Save to both (Firebase async, Local always succeeds)
 */
const saveUser = async (userObj) => {
  const mode = getStorageMode();
  
  // Always save to LocalStorage for offline capability (except pure firebase mode)
  let localResult = { success: true };
  if (mode !== "firebase") {
    localResult = localSaveUser(userObj);
  }

  // If mode is local-only, return immediately
  if (mode === "local") {
    return localResult;
  }

  // Try Firebase if enabled
  if (isFirebaseEnabled()) {
    const fbResult = await fbSaveUser(userObj);
    
    if (fbResult.success) {
      console.log("User saved to Firebase");
      return { success: true, storage: mode === "firebase" ? "firebase" : "both" };
    } else {
      console.warn("Firebase save failed, using LocalStorage fallback");
      // In hybrid mode, local save already succeeded
      if (mode === "hybrid") {
        return { success: true, storage: "local", warning: "Firebase unavailable" };
      }
      // In firebase-only mode, fallback to local
      if (mode === "firebase") {
        return localSaveUser(userObj);
      }
    }
  }

  return localResult;
};

/**
 * Get user registration data
 * Behavior based on storage mode:
 * - "local": Read only from LocalStorage
 * - "firebase": Try Firebase first, fallback to LocalStorage
 * - "hybrid": Try Firebase first, fallback to LocalStorage
 */
const getUser = async (participantId = null) => {
  const mode = getStorageMode();

  // If mode is local-only, skip Firebase
  if (mode === "local") {
    return localGetUser(participantId);
  }

  // Try Firebase first if enabled
  if (isFirebaseEnabled() && participantId) {
    const fbResult = await fbGetUser(participantId);
    
    if (fbResult.success) {
      console.log("User retrieved from Firebase");
      return fbResult;
    } else {
      console.warn("Firebase read failed, trying LocalStorage fallback");
    }
  }

  // Fallback to LocalStorage
  return localGetUser(participantId);
};

/**
 * Delete user registration data
 */
const deleteUser = async (participantId) => {
  const mode = getStorageMode();
  
  // Delete from LocalStorage
  const localResult = localDeleteUser(participantId);

  // If mode includes Firebase, try to delete there too
  if (isFirebaseEnabled() && participantId) {
    await fbDeleteUser(participantId);
  }

  return localResult;
};

/**
 * Record a login attempt (for analytics)
 */
const recordLoginAttempt = async (participantId, success) => {
  const mode = getStorageMode();
  
  if (mode === "local") {
    // Could add local analytics here if needed
    return { success: true };
  }

  if (isFirebaseEnabled() && participantId) {
    return await fbRecordLoginAttempt(participantId, success);
  }

  return { success: true };
};

// ============================================================================
// EXPORTS (for use in app.js)
// ============================================================================

// Make functions available globally
window.StorageModule = {
  // Public API
  saveUser,
  getUser,
  deleteUser,
  recordLoginAttempt,
  
  // Configuration
  getStorageMode,
  setStorageMode,
  isFirebaseEnabled,
  initializeFirebase,
  
  // Direct access to storage layers (for testing/debugging)
  local: {
    save: localSaveUser,
    get: localGetUser,
    delete: localDeleteUser,
  },
  firebase: {
    save: fbSaveUser,
    get: fbGetUser,
    delete: fbDeleteUser,
    recordAttempt: fbRecordLoginAttempt,
  },
};

console.log("Storage module loaded. Current mode:", getStorageMode());
