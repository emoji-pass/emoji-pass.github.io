// Handles registration/login flow, PIN generation, input UI, and localStorage state.
const PIN_LENGTH = 4;
const MAX_EMOJI_REPEAT = 2;
const EMOJI_KEYPAD_SIZE = 10;
const EMOJI_LISTS = {
  smileys: ["😁", "🤣", "😅", "😊", "😎", "😍", "😘", "🤔", "😴", "😡", "🤯", "🥳", ],
  objects: ["📚", "🔒", "💡", "📱", "🎒", "🧭"],
  places: ["🏠",  "🏥", "🗽", "🗼", "🗻", "🌋",],
  nature: ["🌞", "🌧", "🌈", "🔥", "🌙", "⭐", "🌸"]
};
// Keyboard ratio across categories (must sum to 10).
// If you want fully random from all emojis, set USE_CATEGORY_RATIO to false.
const KEYPAD_CATEGORY_RATIO = { smileys: 3, objects: 3, places: 2, nature: 2 };
const USE_CATEGORY_RATIO = true;
const EMOJI_LIST = Object.values(EMOJI_LISTS).flat();

const STORAGE_KEY = "hcs_emoji_auth";
const LOGIN_STATE_KEY = "hcs_logged_in";
const EXPERIMENT_STATUS_KEY = "hcs_experiment_mode"
const EXPERIMENT_CONDITION_KEY = 'hcs_experiment_condition';
const EMOJI_MODE_DEFAULT = true;
const EXPERIMENT_MODE_DEFAULT = true;
const CENSOR_CHAR = "●";
const EMPTY_CHAR = "-";
const FIXED_KEYPAD_KEY = "hcs_fixed_keypad"; // to store 10 selected Emojis for experiment

/*Fisher-Yates alg to shuffle array
Importance of alg: every permutation is equally likely*/
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const pickRandomUnique = (source, count, excludeSet = new Set()) => {
  const candidates = source.filter((item) => !excludeSet.has(item));
  const picked = shuffleArray([...candidates]).slice(0, count);
  picked.forEach((item) => excludeSet.add(item));
  return picked;
};

// Build a 10-key emoji keyboard from category ratios.
const generateEmojiKeyboard = () => {
  if (!USE_CATEGORY_RATIO) {
    return shuffleArray([...EMOJI_LIST]).slice(0, EMOJI_KEYPAD_SIZE);
  }

  const pickedSet = new Set();
  const keys = [];

  Object.entries(KEYPAD_CATEGORY_RATIO).forEach(([category, count]) => {
    const list = EMOJI_LISTS[category] || [];
    keys.push(...pickRandomUnique(list, count, pickedSet));
  });

  if (keys.length < EMOJI_KEYPAD_SIZE) {
    keys.push(...pickRandomUnique(EMOJI_LIST, EMOJI_KEYPAD_SIZE - keys.length, pickedSet));
  }

  return shuffleArray(keys).slice(0, EMOJI_KEYPAD_SIZE);
};

// Save registration payload using storage module (Firebase + LocalStorage fallback).
const saveRegistration = async (payload) => {
  if (window.StorageModule) {
    const result = await window.StorageModule.saveUser(payload);
    return result;
  } else {
    // Fallback to direct localStorage if module not loaded
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { success: true, storage: "local" };
  }
};

// Read and parse registration payload using storage module (Firebase + LocalStorage fallback).
const readRegistration = async (participantId = null) => {
  if (window.StorageModule) {
    const result = await window.StorageModule.getUser(participantId);
    return result.success ? result.data : null;
  } else {
    // Fallback to direct localStorage if module not loaded
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
};

const saveExperimentCondition = (payload) => {
  localStorage.setItem(EXPERIMENT_CONDITION_KEY, JSON.stringify(payload));
  updateAdminPageByExperimentCondition();
  updateHeaderByExperimentCondition();
}

// Save login state to localStorage.
const saveLoginState = (payload) => {
  localStorage.setItem(LOGIN_STATE_KEY, JSON.stringify(payload));
};

const logout = () => {
  saveLoginState(false);
  updatePageByLogin();
  window.location.href="./login.html"
}

// Check if the website is currently in experiment mode.
const isExperiment = () => {
  const raw = localStorage.getItem(EXPERIMENT_STATUS_KEY);
  if (!raw) return EXPERIMENT_MODE_DEFAULT;
  try {
    return JSON.parse(raw) === true;
  } catch {
    return EXPERIMENT_MODE_DEFAULT;
  }
}

const toggleExperimentStatus = (isOn) => {
    localStorage.setItem(EXPERIMENT_STATUS_KEY, JSON.stringify(isOn));
    // if off, clear the fixed keyboard then can randomly reset
    if (!isOn){
      localStorage.removeItem(FIXED_KEYPAD_KEY);
    }
    updatePageByExperimentMode();
    updateAdminPageByExperimentStatus();
}

// Check if user is logged in by reading login state from localStorage.
const isLoggedIn = () => {
  const raw = localStorage.getItem(LOGIN_STATE_KEY);
  if (!raw) return false;
  try {
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
};

const isEmojiMode = () => {
  const raw = localStorage.getItem(EXPERIMENT_CONDITION_KEY);
  if (!raw) return true;
  try {
    return JSON.parse(raw) === "emoji";
  } catch {
    // default to emoji mode default
    return EMOJI_MODE_DEFAULT;
  }  
}

// Obtain the currently available set of Emojis
const getEmojiPool = () => {
  if (!isExperiment()) return EMOJI_LIST; // use all emoji if under experiment off

  const stored = localStorage.getItem(FIXED_KEYPAD_KEY);
  if (stored) {
    return JSON.parse(stored); // if already fixed then return 
  }

  // Experiment ON: create one fixed 10-key keyboard (uses current category ratio settings).
  const newPool = generateEmojiKeyboard();
  localStorage.setItem(FIXED_KEYPAD_KEY, JSON.stringify(newPool));
  return newPool;
};

const getExperimentCondition = () => {
  if (isEmojiMode()) {
    return "emoji";
  }
  else {
    return "digits";
  }
}

// Generate a random numeric PIN (digits can repeat).
const randomDigitPin = () => {
  const digits = [];
  for (let i = 0; i < PIN_LENGTH; i += 1) {
    digits.push(Math.floor(Math.random() * 10).toString());
  }
  return digits.join("");
};

// Generate a random emoji PIN (each emoji can appear at most MAX_EMOJI_REPEAT times).
const randomEmojiPin = (pool = getEmojiPool()) => {
  const counts = new Map();
  const result = [];
  while (result.length < PIN_LENGTH) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const used = counts.get(pick) || 0;
    if (used >= MAX_EMOJI_REPEAT) continue;
    counts.set(pick, used + 1);
    result.push(pick);
  }
  return result.join("");
};

// Format input display: dots for password censor
const formatInputDisplay = (inputArray) => {
  if (inputArray.length === 0) return "----";
  let censorLen = PIN_LENGTH - inputArray.length;
  return CENSOR_CHAR.repeat(inputArray.length)+EMPTY_CHAR.repeat(censorLen);
};

// Update the small length counter under the input display.
const updateLengthMeta = (metaEl, length) => {
  if (!metaEl) return;
  metaEl.textContent = `Length ${length} / ${PIN_LENGTH}`;
};

const createKeyButton = (label, onClick) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.addEventListener("click", () => onClick(label));
  return btn;
};

// fill keypad w/ passcode type, takes the keypad element and func for key handling
const fillKeypad = (type, keypad, handleKey, requiredChars = "", fixedEmojiKeys = null) => {
  keypad.innerHTML = "";
  keypad.className = `keypad ${type}`;

  let keysToRender = [];

  if (type === "digits") {
    keysToRender = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  } else {
    if (Array.isArray(fixedEmojiKeys) && fixedEmojiKeys.length > 0) {
      keysToRender = [...fixedEmojiKeys];
      keysToRender.forEach((k) => {
        keypad.appendChild(createKeyButton(k, handleKey));
      });
      return;
    }

    /*Identify the passcode emojis */
    const requiredSet = new Set([...requiredChars]);
    const requiredArray = Array.from(requiredSet);

    const availableExtras = EMOJI_LIST.filter(e => !requiredSet.has(e));

    const slotsNeeded = 10 - requiredArray.length;

    // experiment ON: no randomisation, fixed extras and fixed order
    if (isExperiment()){ // fix order, not shuffle
      // directly obtain the fixed emoji pool under experiment on
      keysToRender = getEmojiPool();
    }
    else{ //keep random under experiment off
      const requiredSet = new Set([...requiredChars]);
      const requiredArray = Array.from(requiredSet);
      const availableExtras = EMOJI_LIST.filter(e => !requiredSet.has(e));
      const shuffledExtras = shuffleArray([...availableExtras]);
      const slotsNeeded = 10 - requiredArray.length;
      const selectedExtras = shuffledExtras.slice(0, slotsNeeded);
      keysToRender = shuffleArray([...requiredArray, ...selectedExtras]);
    }
  }

  keysToRender.forEach((k) => {
    keypad.appendChild(createKeyButton(k, handleKey));
  });

};

const updatePageByLogin = () => {
  const widget = document.getElementById("register-login-widget");
  if (!widget) return;

  if (isLoggedIn()) {
    widget.innerHTML = "<a href=\"./account.html\" class=\"nav-link\"><p>My Account</p></a><a href=\"./account.html\"><img id=\"profile-picture\" src=\"resources/profile.png\" alt=\"Profile picture placeholder\"></a>";
  }

  // Update mobile menu
  const mobileLoginLink = document.querySelector(".mobile-login-link");
  const mobileRegisterLink = document.querySelector(".mobile-register-link");
  const mobileAccountLink = document.querySelector(".mobile-account-link");

  if (mobileLoginLink && mobileRegisterLink && mobileAccountLink) {
    if (isLoggedIn()) {
      mobileLoginLink.style.display = "none";
      mobileRegisterLink.style.display = "none";
      mobileAccountLink.style.display = "flex";
    } else {
      mobileLoginLink.style.display = "flex";
      mobileRegisterLink.style.display = "flex";
      mobileAccountLink.style.display = "none";
    }
  }
};

const updateAdminPageByExperimentStatus = () => {
  const experimentOnLabel = document.getElementById("experiment-on");
  if (!experimentOnLabel) return;

  if (isExperiment()) {
    if (experimentOnLabel.classList.contains("ghost")) {
      experimentOnLabel.classList.remove("ghost");
      experimentOnLabel.classList.add("primary");
    }
  }
  else {
    if (experimentOnLabel.classList.contains("primary")) {
      experimentOnLabel.classList.remove("primary");
      experimentOnLabel.classList.add("ghost");
    }    
  }

  const experimentOffLabel = document.getElementById("experiment-off");
  if (!experimentOffLabel) return;

  if (!isExperiment()) {
    if (experimentOffLabel.classList.contains("ghost")) {
      experimentOffLabel.classList.remove("ghost");
      experimentOffLabel.classList.add("primary");
    }
  }
  else {
    if (experimentOffLabel.classList.contains("primary")) {
      experimentOffLabel.classList.remove("primary");
      experimentOffLabel.classList.add("ghost");
    }    
  }
};

const updateAdminPageByExperimentCondition = () => {
  const emojiLabel = document.getElementById("emoji-mode");
  if (!emojiLabel) return;

  if (isEmojiMode()) {
    if (emojiLabel.classList.contains("ghost")) {
      emojiLabel.classList.remove("ghost");
      emojiLabel.classList.add("primary");
    }
  }
  else {
    if (emojiLabel.classList.contains("primary")) {
      emojiLabel.classList.remove("primary");
      emojiLabel.classList.add("ghost");
    }    
  }

  const digitsLabel = document.getElementById("digits-mode");
  if (!digitsLabel) return;

  if (!isEmojiMode()) {
    if (digitsLabel.classList.contains("ghost")) {
      digitsLabel.classList.remove("ghost");
      digitsLabel.classList.add("primary");
    }
  }
  else {
    if (digitsLabel.classList.contains("primary")) {
      digitsLabel.classList.remove("primary");
      digitsLabel.classList.add("ghost");
    }    
  }
};

const setupStorageMode = () => {
  // Storage mode management - wrapper function for admin controls
  window.setStorageMode = (mode) => {
    if (window.StorageModule) {
      const success = window.StorageModule.setStorageMode(mode);
      if (success) {
        console.log(`Storage mode set to: ${mode}`);
        updateAdminPageByStorageMode();
      }
    }
  };
};

const updateAdminPageByStorageMode = () => {
  const currentMode = window.StorageModule ? window.StorageModule.getStorageMode() : 'hybrid';
  
  // Update the display text
  const currentModeLabel = document.getElementById("current-storage-mode");
  if (currentModeLabel) {
    currentModeLabel.textContent = currentMode;
  }

  // Update button styles
  const modes = ['local', 'hybrid', 'firebase'];
  modes.forEach(mode => {
    const btn = document.getElementById(`storage-${mode}`);
    if (!btn) return;
    
    if (mode === currentMode) {
      if (btn.classList.contains("ghost")) {
        btn.classList.remove("ghost");
        btn.classList.add("primary");
      }
    } else {
      if (btn.classList.contains("primary")) {
        btn.classList.remove("primary");
        btn.classList.add("ghost");
      }
    }
  });
};

const updatePageByExperimentMode = () => {
  document.querySelectorAll('.experiment-hidden-toggle').forEach((item) => {
    if (!isExperiment()) {
      item.style.display = "flex";
    }
    else {
      item.style.display = "none";
    }
  });
}

const isDefaultMode = () => {
  return (isEmojiMode() == EMOJI_MODE_DEFAULT);
}

const updateHeaderByExperimentCondition = () => {
  const logo = document.getElementById("logo");
  if (!logo) return;

  console.log(isDefaultMode());

  if (!isDefaultMode()) {
    logo.src = "resources/alternative-logo.png";
  }
}

// Initialize the register page if present.
const setupRegisterPage = () => {
  const form = document.getElementById("register-form");
  if (!form) return;

  //Admin logic
  const activeCondition = getExperimentCondition(); // get "emoji" or "digits"
  const fieldset = form.querySelector('fieldset');
  
  if (fieldset) {
    fieldset.style.display = 'none'; // hide the password type selection
    const targetRadio = form.querySelector(`input[name="password-type"][value="${activeCondition}"]`);
    if (targetRadio) targetRadio.checked = true; // auto check this button
  }

  const participantInput = document.getElementById("participant-id");
  const usernameInput = document.getElementById("username");
  const confirmSec = document.getElementById("confirm-passcode");

  const confirmDisplay = document.getElementById("confirm-display");
  const confirmKeypad = document.getElementById("confirm-keypad");
  const confirmForm = document.getElementById("result");
  const confirmMessage = document.getElementById("confirm-message");
  const confirmClearBtn = document.getElementById("confirm-clear");
  const goLoginBtn = document.getElementById("go-login");
  const passwordDisplay = document.getElementById("generated-password");

  let pendingRegistration = "";
  let confirmInput = [];

  const renderConfirm = () => {
    confirmDisplay.textContent = formatInputDisplay(confirmInput);
  };

  const generateBtn = document.getElementById("generate-btn");

  const updateRegButtonState = () => {
    // participant id and username cannot be empty/whitespace
    const isValid = participantInput.value.trim().length > 0 && usernameInput.value.trim().length > 0;
    generateBtn.disabled = !isValid;
  };

  if (participantInput && usernameInput && generateBtn) {
    participantInput.addEventListener("input", updateRegButtonState);
    usernameInput.addEventListener("input", updateRegButtonState);
    
    //load once incase of autofill or if user went back a page
    updateRegButtonState(); 
  }

  //generates password DOES NOT SAVE
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const passwordType = formData.get("password-type");
    const participantId = (participantInput?.value || "").trim();
    const username = (usernameInput?.value || "").trim();

    const generatedKeypad = passwordType === "emoji"
      ? (isExperiment() ? getEmojiPool() : generateEmojiKeyboard())
      : null;
    const generatedPassword = passwordType === "emoji" ? randomEmojiPin(generatedKeypad) : randomDigitPin();
    pendingRegistration = {
      participant_id: participantId,
      username: username,
      password_type: passwordType,
      generated_password: generatedPassword,
      generated_keypad: generatedKeypad,
      created_at: new Date().toISOString(),
    };

    passwordDisplay.textContent = generatedPassword;
    confirmSec.classList.remove("hidden");
    goLoginBtn.disabled = true; //need to confirm password, can't login yet
    confirmMessage.classList.add("hidden");

    confirmInput = [];
    renderConfirm();

    const handleKey = (val) => {
      if (confirmInput.length < PIN_LENGTH) {
        confirmInput.push(val);
        renderConfirm();
      }
    };
    
    fillKeypad(passwordType, confirmKeypad, handleKey, generatedPassword, generatedKeypad);
  });

  confirmClearBtn.addEventListener("click", () => {
    confirmInput = [];
    renderConfirm();
  });

  //saves passcode after confirmation
  confirmForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    if (!pendingRegistration) return;

    const attempt = confirmInput.join("");
    
    if (attempt === pendingRegistration.generated_password) {
      // MATCH: Save to storage (Firebase + LocalStorage)
      const saveResult = await saveRegistration(pendingRegistration);
      
      if (saveResult.success) {
        confirmMessage.textContent = "Success! Account registered.";
        confirmMessage.className = "message success";
        goLoginBtn.disabled = false;
        
        confirmKeypad.innerHTML = ""; //shut down keypad, no typing after success
        
        // Optional: Show storage location for debugging
        if (saveResult.storage) {
          console.log(`User saved to: ${saveResult.storage}`);
        }
      } else {
        confirmMessage.textContent = "Error saving account. Please try again.";
        confirmMessage.className = "message error";
      }
    } else {
      confirmMessage.textContent = "Incorrect. Please try entering the password again.";
      confirmMessage.className = "message error";
      confirmInput = [];
      renderConfirm();
    }
  });

  goLoginBtn.addEventListener("click", () => {
    window.location.href = "login.html";
  });

  // listen stroage change
  window.addEventListener('storage', (event) => {
  if (event.key === EXPERIMENT_CONDITION_KEY) {
    // once change in admin, refresh 
    window.location.reload();
  }
});
};

// Initialize the login page if present.
const setupLoginPage = async () => {
  const panel = document.getElementById("login-panel");
  if (!panel) return;

  const keypad = document.getElementById("keypad");
  const inputDisplay = document.getElementById("input-display");
  const meta = document.getElementById("input-meta");
  const message = document.getElementById("message");
  const clearBtn = document.getElementById("clear");
  const loginBtn = document.getElementById("login");
  const hint = document.getElementById("login-hint");

  const registration = await readRegistration();
  if (!registration) {
    hint.textContent = "No registration found. Please register first.";
    panel.classList.add("hidden");
    message.classList.remove("hidden");
    message.textContent = "Generate a password on the registration page first.";
    message.classList.add("error");
    return;
  }

  const passwordType = getExperimentCondition();
  let currentInput = [];

  const renderInput = () => {
    inputDisplay.textContent = formatInputDisplay(currentInput);
    updateLengthMeta(meta, currentInput.length);
  };

  const handleKey = (value) => {
    if (currentInput.length >= PIN_LENGTH) return;
    currentInput = currentInput.concat(value);
    renderInput();
  };

  const backspace = () => {
    if (currentInput.length === 0) return;
    currentInput = currentInput.slice(0, -1);
    renderInput();
  };

  const clearAll = () => {
    currentInput = [];
    renderInput();
  };

  const showMessage = (text, type) => {
    message.classList.remove("hidden", "success", "error");
    message.textContent = text;
    message.classList.add(type);
  };

  keypad.innerHTML = "";
  keypad.classList.add(passwordType === "emoji" ? "emoji" : "digits");

  const storedPassword = registration.generated_password || "";
  const storedKeypad = Array.isArray(registration.generated_keypad) ? registration.generated_keypad : null;
  fillKeypad(passwordType, keypad, handleKey, storedPassword, storedKeypad)

  clearBtn.addEventListener("click", clearAll);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      backspace();
      return;
    }
    if (event.key === "Delete") {
      event.preventDefault();
      clearAll();
      return;
    }
    if (passwordType === "digits" && /^[0-9]$/.test(event.key)) {
      pushInput(event.key);
    }
  });

  loginBtn.addEventListener("click", async () => {
    if (currentInput.length !== PIN_LENGTH) {
      showMessage(`Please enter ${PIN_LENGTH} characters`, "error");
      return;
    }
    const inputValue = currentInput.join("");
    const isCorrect = inputValue === registration.generated_password;
    
    if (isCorrect) {
      saveLoginState(true);
      updatePageByLogin();
      showMessage("Login successful ✅", "success");
      
      // Record successful login attempt (for analytics)
      if (window.StorageModule && registration.participant_id) {
        await window.StorageModule.recordLoginAttempt(registration.participant_id, true);
      }
    } else {
      showMessage("Incorrect password, try again.", "error");
      clearAll();
      
      // Record failed login attempt (for analytics)
      if (window.StorageModule && registration.participant_id) {
        await window.StorageModule.recordLoginAttempt(registration.participant_id, false);
      }
    }
  });

  renderInput();
};

const setupHamburgerMenu = () => {
  // Hamburger menu toggle
  const hamburgerMenu = document.getElementById("hamburger-menu");
  const mobileMenu = document.getElementById("mobile-menu");

  if (hamburgerMenu && mobileMenu) {
    hamburgerMenu.addEventListener("click", () => {
      hamburgerMenu.classList.toggle("active");
      mobileMenu.classList.toggle("active");
    });

    // Close menu when a link is clicked
    mobileMenu.querySelectorAll(".mobile-nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        hamburgerMenu.classList.remove("active");
        mobileMenu.classList.remove("active");
      });
    });
  }
};

const updateHeader = () => {
  updatePageByLogin();
  updateHeaderByExperimentCondition();
  updatePageByExperimentMode();
  setupHamburgerMenu();
}

const updatePage = () => {
  setupRegisterPage();
  setupLoginPage();
  updateAdminPageByExperimentCondition();
  updateAdminPageByExperimentStatus();
  updateAdminPageByStorageMode();
  setupStorageMode();
}
