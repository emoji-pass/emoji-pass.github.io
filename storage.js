// Storage module with Firebase + LocalStorage fallback
// Handles user registration data with hybrid cloud/local storage

// ============================================================================
// CONFIGURATION
// ============================================================================

const STORAGE_CONFIG = {
  LOCAL_KEY: "hcs_emoji_auth",
  LOCAL_METRICS_KEY: "hcs_login_metrics",
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
let firebaseAuthReady = false;
let resolveFirebaseAuthReady;
let firebaseAuthReadyPromise = new Promise((resolve) => {
  resolveFirebaseAuthReady = resolve;
});

const resetFirebaseAuthReadyPromise = () => {
  firebaseAuthReadyPromise = new Promise((resolve) => {
    resolveFirebaseAuthReady = resolve;
  });
};

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

const setFirebaseAuthReady = (isReady) => {
  const nextState = Boolean(isReady);
  const wasReady = firebaseAuthReady;
  firebaseAuthReady = nextState;

  if (nextState && resolveFirebaseAuthReady) {
    resolveFirebaseAuthReady(true);
    resolveFirebaseAuthReady = null;
  }

  if (!nextState && wasReady) {
    resetFirebaseAuthReadyPromise();
  }
};

const waitForFirebaseAuthReady = async (timeoutMs = 4000) => {
  if (firebaseAuthReady) {
    return true;
  }

  if (!isFirebaseAvailable() || typeof firebase.auth === "undefined") {
    return false;
  }

  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve(false), timeoutMs);
  });

  const readyResult = await Promise.race([firebaseAuthReadyPromise, timeoutPromise]);
  return Boolean(readyResult);
};

const ensureFirebaseAuthReady = async () => {
  if (!isFirebaseEnabled()) {
    return false;
  }

  if (!firebaseInitialized || !firebaseDatabase) {
    return false;
  }

  if (typeof firebase === "undefined" || typeof firebase.auth === "undefined") {
    return false;
  }

  if (firebase.auth().currentUser) {
    setFirebaseAuthReady(true);
    return true;
  }

  const becameReady = await waitForFirebaseAuthReady();
  if (becameReady || firebase.auth().currentUser) {
    setFirebaseAuthReady(true);
    return true;
  }

  try {
    await firebase.auth().signInAnonymously();
    setFirebaseAuthReady(true);
    return true;
  } catch (error) {
    console.warn("Firebase auth not ready for database access:", error);
    setFirebaseAuthReady(false);
    return false;
  }
};

const formatDateTime24 = (dateInput = new Date()) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return formatDateTime24(new Date());
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const toDateTime24 = (value) => {
  if (!value) {
    return formatDateTime24();
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  return formatDateTime24(value);
};

const normalizeMetricsPayload = (rawMetrics = {}) => {
  const metrics = rawMetrics && typeof rawMetrics === "object" ? rawMetrics : {};

  const loginAttemptsTotal = Number.isFinite(metrics.login_attempts_total)
    ? Number(metrics.login_attempts_total)
    : 0;
  const loginSuccessCount = Number.isFinite(metrics.login_success_count)
    ? Number(metrics.login_success_count)
    : 0;
  const loginFailureCount = Number.isFinite(metrics.login_failure_count)
    ? Number(metrics.login_failure_count)
    : 0;

  const normalizedSuccessRate = loginAttemptsTotal > 0
    ? Number((loginSuccessCount / loginAttemptsTotal).toFixed(4))
    : 0;

  const firstAttemptSuccess = typeof metrics.first_attempt_success === "boolean"
    ? metrics.first_attempt_success
    : false;

  const normalized = {
    login_attempts_total: loginAttemptsTotal,
    login_success_count: loginSuccessCount,
    login_failure_count: loginFailureCount,
    success_rate: Number.isFinite(metrics.success_rate) ? Number(metrics.success_rate) : normalizedSuccessRate,
    first_attempt_success: firstAttemptSuccess,
  };

  if (typeof metrics.last_attempt_at === "string") {
    normalized.last_attempt_at = metrics.last_attempt_at;
  }

  return normalized;
};

// ============================================================================
// LOCAL STORAGE FUNCTIONS
// ============================================================================

const localSaveUser = (userObj) => {
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG.LOCAL_KEY);
    const existing = raw ? JSON.parse(raw) : null;

    const passwordType = userObj.password_type === "digits" ? "digits" : "emoji";
    const generatedPassword = typeof userObj.generated_password === "string" ? userObj.generated_password : "";
    const createdAt = toDateTime24(userObj.created_at);

    const existingPasswords = existing && existing.passwords && typeof existing.passwords === "object"
      ? existing.passwords
      : {};

    const nextPayload = {
      ...(existing && typeof existing === "object" ? existing : {}),
      ...userObj,
      password_type: passwordType,
      generated_password: generatedPassword,
      created_at: createdAt,
      passwords: {
        ...existingPasswords,
        [passwordType]: {
          generated_password: generatedPassword,
          created_at: createdAt,
        },
      },
    };

    localStorage.setItem(STORAGE_CONFIG.LOCAL_KEY, JSON.stringify(nextPayload));
    return { success: true };
  } catch (error) {
    console.error("LocalStorage save failed:", error);
    return { success: false, error: error.message };
  }
};

const localGetUser = (username, preferredPasswordType = null) => {
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG.LOCAL_KEY);
    if (!raw) return { success: false, error: "No user found" };
    
    const userData = JSON.parse(raw);
    
    const storedUsername = userData.username;

    // If username is provided, verify it matches (for future multi-user support)
    if (username && storedUsername !== username) {
      return { success: false, error: "User not found" };
    }

    if (storedUsername && !userData.username) {
      userData.username = storedUsername;
    }

    const passwords = userData.passwords && typeof userData.passwords === "object"
      ? userData.passwords
      : null;

    if (passwords) {
      const preferredType = preferredPasswordType === "digits" ? "digits" : preferredPasswordType === "emoji" ? "emoji" : null;
      const fallbackType = userData.password_type === "digits" ? "digits" : "emoji";
      const selectedType = preferredType && passwords[preferredType]
        ? preferredType
        : passwords[fallbackType]
          ? fallbackType
          : passwords.emoji
            ? "emoji"
            : passwords.digits
              ? "digits"
              : null;

      if (selectedType && passwords[selectedType]) {
        userData.password_type = selectedType;
        userData.generated_password = passwords[selectedType].generated_password || "";
        userData.created_at = toDateTime24(passwords[selectedType].created_at || userData.created_at);
      }
    }
    
    return { success: true, data: userData };
  } catch (error) {
    console.error("LocalStorage read failed:", error);
    return { success: false, error: error.message };
  }
};

const localDeleteUser = (username) => {
  try {
    localStorage.removeItem(STORAGE_CONFIG.LOCAL_KEY);
    return { success: true };
  } catch (error) {
    console.error("LocalStorage delete failed:", error);
    return { success: false, error: error.message };
  }
};

const localGetMetricsMap = () => {
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG.LOCAL_METRICS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const localSaveMetricsMap = (metricsMap) => {
  try {
    localStorage.setItem(STORAGE_CONFIG.LOCAL_METRICS_KEY, JSON.stringify(metricsMap));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const localRecordLoginAttempt = (username, payload = {}) => {
  const key = username || "unknown_username";
  const metricsMap = localGetMetricsMap();
  const current = metricsMap[key] || {
    login_attempts_total: 0,
    login_success_count: 0,
    login_failure_count: 0,
    first_attempt_success: null,
    success_rate: 0,
  };

  const success = Boolean(payload.success);
  current.login_attempts_total += 1;
  if (success) {
    current.login_success_count += 1;
  } else {
    current.login_failure_count += 1;
  }

  if (current.login_attempts_total === 1 && current.first_attempt_success === null) {
    current.first_attempt_success = success;
  }

  current.success_rate = current.login_attempts_total > 0
    ? Number((current.login_success_count / current.login_attempts_total).toFixed(4))
    : 0;
  current.last_attempt_at = formatDateTime24();

  metricsMap[key] = current;
  const saveResult = localSaveMetricsMap(metricsMap);
  if (!saveResult.success) {
    return saveResult;
  }

  return { success: true, data: current };
};

const localGetUserMetrics = (username) => {
  const metricsMap = localGetMetricsMap();
  const key = username || "unknown_username";
  return { success: true, data: metricsMap[key] || null };
};

// ============================================================================
// FIREBASE FUNCTIONS
// ============================================================================

const fbSaveUser = async (userObj) => {
  if (!firebaseInitialized || !firebaseDatabase) {
    return { success: false, error: "Firebase not initialized" };
  }

  try {
    const username = userObj.username;
    if (!username) {
      return { success: false, error: "Username required" };
    }

    const userRef = firebaseDatabase.ref(`${STORAGE_CONFIG.FIREBASE_DB_PATH}/${username}`);
    const metaRef = userRef.child("meta");
    const passwordsRef = userRef.child("passwords");
    const eventsRef = userRef.child("events");
    const metricsRef = userRef.child("metrics");

    const existingMetaSnapshot = await metaRef.once("value");
    const existingMeta = existingMetaSnapshot.exists() ? existingMetaSnapshot.val() : {};

    const createdAt = toDateTime24(existingMeta.created_at || userObj.created_at);

    const passwordType = userObj.password_type === "digits" ? "digits" : "emoji";

    const generatedKeypad = Array.isArray(userObj.generated_keypad)
      ? userObj.generated_keypad
      : [];

    const metaPayload = {
      username,
      password_type: passwordType,
      generated_password: userObj.generated_password || "",
      created_at: createdAt,
      generated_keypad: generatedKeypad,
    };

    await metaRef.set(metaPayload);
    await passwordsRef.child(passwordType).set({
      generated_password: metaPayload.generated_password,
      created_at: metaPayload.created_at,
    });

    await eventsRef.push({
      condition: metaPayload.password_type,
      attempt_number: 1,
      success: true,
      duration_ms: 0,
      timestamp: formatDateTime24(),
    });

    await metricsRef.transaction((current) => {
      const baseline = normalizeMetricsPayload(current);
      return baseline;
    });

    console.log(`User ${username} saved to Firebase`);
    return { success: true };
  } catch (error) {
    console.error("Firebase save failed:", error);
    return { success: false, error: error.message };
  }
};

const fbGetUser = async (username, preferredPasswordType = null) => {
  if (!firebaseInitialized || !firebaseDatabase) {
    return { success: false, error: "Firebase not initialized" };
  }

  try {
    if (!username) {
      return { success: false, error: "Username required" };
    }

    const userRef = firebaseDatabase.ref(`${STORAGE_CONFIG.FIREBASE_DB_PATH}/${username}`);
    const snapshot = await userRef.once("value");
    
    if (!snapshot.exists()) {
      return { success: false, error: "User not found" };
    }

    const userData = snapshot.val();
    const passwords = userData.passwords && typeof userData.passwords === "object" ? userData.passwords : null;
    const preferredType = preferredPasswordType === "digits" ? "digits" : preferredPasswordType === "emoji" ? "emoji" : null;
    const metaType = userData.meta && userData.meta.password_type === "digits" ? "digits" : "emoji";
    const selectedType = passwords
      ? preferredType && passwords[preferredType]
        ? preferredType
        : passwords[metaType]
          ? metaType
          : passwords.emoji
            ? "emoji"
            : passwords.digits
              ? "digits"
              : null
      : null;

    const normalizedData = userData.meta
      ? {
          meta: userData.meta,
          ...userData.meta,
          generated_password: selectedType && passwords && passwords[selectedType]
            ? passwords[selectedType].generated_password || userData.meta.generated_password || ""
            : userData.meta.generated_password || "",
          password_type: selectedType || userData.meta.password_type || "emoji",
          passwords: passwords || {},
          events: userData.events || {},
          metrics: normalizeMetricsPayload(userData.metrics || {}),
        }
      : userData;

    console.log(`User ${username} retrieved from Firebase`);
    return { success: true, data: normalizedData };
  } catch (error) {
    console.error("Firebase read failed:", error);
    return { success: false, error: error.message };
  }
};

const fbDeleteUser = async (username) => {
  if (!firebaseInitialized || !firebaseDatabase) {
    return { success: false, error: "Firebase not initialized" };
  }

  try {
    if (!username) {
      return { success: false, error: "Username required" };
    }

    const userRef = firebaseDatabase.ref(`${STORAGE_CONFIG.FIREBASE_DB_PATH}/${username}`);
    await userRef.remove();
    console.log(`User ${username} deleted from Firebase`);
    return { success: true };
  } catch (error) {
    console.error("Firebase delete failed:", error);
    return { success: false, error: error.message };
  }
};

// Record login attempt (optional analytics)
const fbRecordLoginAttempt = async (username, payload = {}) => {
  if (!firebaseInitialized || !firebaseDatabase) {
    return { success: false, error: "Firebase not initialized" };
  }

  try {
    if (!username) {
      return { success: false, error: "Username required" };
    }

    const userRef = firebaseDatabase.ref(`${STORAGE_CONFIG.FIREBASE_DB_PATH}/${username}`);
    const metaRef = userRef.child("meta");
    const eventsRef = userRef.child("events");
    const metricsRef = userRef.child("metrics");

    const success = Boolean(payload.success);
    const resolvedCondition = payload.condition === "digits" ? "digits" : payload.condition === "emoji" ? "emoji" : null;
    const durationMs = Number.isFinite(payload.duration_ms) ? payload.duration_ms : 0;

    const userSnapshot = await userRef.once("value");
    const userData = userSnapshot.exists() ? userSnapshot.val() : {};
    const existingMeta = userData && typeof userData.meta === "object" ? userData.meta : null;

    if (!existingMeta) {
      const migratedMeta = {
        username,
        password_type: userData.password_type === "digits" ? "digits" : "emoji",
        generated_password: typeof userData.generated_password === "string" ? userData.generated_password : "",
        created_at: toDateTime24(userData.created_at),
      };

      await metaRef.set(migratedMeta);
    }

    const condition = resolvedCondition || (existingMeta && existingMeta.password_type === "digits" ? "digits" : "emoji");

    const metricsTransaction = await metricsRef.transaction((current) => {
      const metrics = normalizeMetricsPayload(current);

      const attempts = (metrics.login_attempts_total || 0) + 1;
      const successCount = (metrics.login_success_count || 0) + (success ? 1 : 0);
      const failureCount = (metrics.login_failure_count || 0) + (success ? 0 : 1);

      return {
        ...metrics,
        login_attempts_total: attempts,
        login_success_count: successCount,
        login_failure_count: failureCount,
        success_rate: Number((successCount / attempts).toFixed(4)),
        first_attempt_success: attempts === 1
          ? success
          : metrics.first_attempt_success,
      };
    });

    const attemptNumber = metricsTransaction && metricsTransaction.snapshot && metricsTransaction.snapshot.exists()
      ? metricsTransaction.snapshot.val().login_attempts_total || 1
      : 1;

    await eventsRef.push({
      condition,
      attempt_number: attemptNumber,
      success,
      duration_ms: durationMs,
      timestamp: formatDateTime24(),
    });

    const metricsUpdates = {
      last_attempt_at: formatDateTime24(),
    };

    await metricsRef.update(metricsUpdates);

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
    const canUseFirebase = await ensureFirebaseAuthReady();
    if (!canUseFirebase) {
      if (mode === "hybrid") {
        return { success: true, storage: "local", warning: "Firebase auth unavailable" };
      }
      if (mode === "firebase") {
        return localSaveUser(userObj);
      }
    }

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
const getUser = async (username = null, preferredPasswordType = null) => {
  const mode = getStorageMode();

  // If mode is local-only, skip Firebase
  if (mode === "local") {
    return localGetUser(username, preferredPasswordType);
  }

  // Try Firebase first if enabled
  if (isFirebaseEnabled() && username) {
    const canUseFirebase = await ensureFirebaseAuthReady();
    if (!canUseFirebase) {
      return localGetUser(username);
    }

    const fbResult = await fbGetUser(username, preferredPasswordType);
    
    if (fbResult.success) {
      console.log("User retrieved from Firebase");
      return fbResult;
    } else {
      console.warn("Firebase read failed, trying LocalStorage fallback");
    }
  }

  // Fallback to LocalStorage
  return localGetUser(username, preferredPasswordType);
};

/**
 * Delete user registration data
 */
const deleteUser = async (username) => {
  const mode = getStorageMode();
  
  // Delete from LocalStorage
  const localResult = localDeleteUser(username);

  // If mode includes Firebase, try to delete there too
  if (isFirebaseEnabled() && username) {
    await fbDeleteUser(username);
  }

  return localResult;
};

/**
 * Record a login attempt (for analytics)
 */
const recordLoginAttempt = async (username, success) => {
  const mode = getStorageMode();
  const payload = typeof success === "object" ? success : { success: Boolean(success) };
  
  if (mode === "local") {
    return localRecordLoginAttempt(username, payload);
  }

  if (isFirebaseEnabled() && username) {
    const canUseFirebase = await ensureFirebaseAuthReady();
    if (!canUseFirebase) {
      return localRecordLoginAttempt(username, payload);
    }

    const fbResult = await fbRecordLoginAttempt(username, payload);
    if (fbResult.success) return fbResult;

    // In hybrid mode, fallback to local metrics tracking.
    if (mode === "hybrid") {
      return localRecordLoginAttempt(username, payload);
    }
    return fbResult;
  }

  return localRecordLoginAttempt(username, payload);
};

const getUserMetrics = async (username) => {
  const mode = getStorageMode();

  if (mode !== "local" && isFirebaseEnabled() && username && firebaseInitialized && firebaseDatabase) {
    try {
      const canUseFirebase = await ensureFirebaseAuthReady();
      if (!canUseFirebase) {
        if (mode === "firebase") {
          return { success: false, error: "Firebase auth unavailable" };
        }
        return localGetUserMetrics(username);
      }

      const metricsRef = firebaseDatabase.ref(`${STORAGE_CONFIG.FIREBASE_DB_PATH}/${username}/metrics`);
      const snapshot = await metricsRef.once("value");
      return { success: true, data: snapshot.exists() ? snapshot.val() : null };
    } catch (error) {
      if (mode === "firebase") {
        return { success: false, error: error.message };
      }
    }
  }

  return localGetUserMetrics(username);
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
  getUserMetrics,
  
  // Configuration
  getStorageMode,
  setStorageMode,
  isFirebaseEnabled,
  initializeFirebase,
  setFirebaseAuthReady,
  
  // Direct access to storage layers (for testing/debugging)
  local: {
    save: localSaveUser,
    get: localGetUser,
    delete: localDeleteUser,
    getMetrics: localGetUserMetrics,
  },
  firebase: {
    save: fbSaveUser,
    get: fbGetUser,
    delete: fbDeleteUser,
    recordAttempt: fbRecordLoginAttempt,
  },
};

console.log("Storage module loaded. Current mode:", getStorageMode());
