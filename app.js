// Handles registration/login flow, PIN generation, input UI, and localStorage state.
const PIN_LENGTH = 4;
const MAX_EMOJI_REPEAT = 2;
const EMOJI_LIST = ["😀", "😁", "😂", "🤣", "😅", "😊", "😎", "😍", "😘", "🤔", "😴", "😡", "🤯", "🥳", "😈", "🤖"];

const STORAGE_KEY = "hcs_emoji_auth";
const LOGIN_STATE_KEY = "hcs_logged_in";
const EXPERIMENT_STATUS_KEY = "hcs_experiment_mode"
const EXPERIMENT_CONDITION_KEY = 'hcs_experiment_condition';
const CENSOR_CHAR = "●";
const EMPTY_CHAR = "-";

/*Fisher-Yates alg to shuffle array
Importance of alg: every permutation is equally likely*/
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// Save registration payload into localStorage.
const saveRegistration = (payload) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

// Read and parse registration payload from localStorage.
const readRegistration = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveExperimentCondition = (payload) => {
  localStorage.setItem(EXPERIMENT_CONDITION_KEY, JSON.stringify(payload));
      updateAdminPageByExperimentCondition();
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
  if (!raw) return false;
  try {
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}

const toggleExperimentStatus = (isOn) => {
    localStorage.setItem(EXPERIMENT_STATUS_KEY, JSON.stringify(isOn));
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
    // default to true
    return true;
  }  
}

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
const randomEmojiPin = () => {
  const counts = new Map();
  const result = [];
  while (result.length < PIN_LENGTH) {
    const pick = EMOJI_LIST[Math.floor(Math.random() * EMOJI_LIST.length)];
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
const fillKeypad = (type, keypad, handleKey, requiredChars = "") => {
  keypad.innerHTML = "";
  keypad.className = `keypad ${type}`;

  let keysToRender = [];

  if (type === "digits") {
    keysToRender = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  } else {
    /*Identify the passcode emojis */
    const requiredSet = new Set([...requiredChars]);
    const requiredArray = Array.from(requiredSet);

    const availableExtras = EMOJI_LIST.filter(e => !requiredSet.has(e));

    const slotsNeeded = 10 - requiredArray.length;

    // experiment ON: no randomisation, fixed extras and fixed order
    if (isExperiment()){ // fix order, not shuffle
      const selectedExtras= availableExtras.slice(0, slotsNeeded);
      keysToRender= [...requiredArray, ...selectedExtras];
    }
    else{ //keep random 
      const shuffledExtras = shuffleArray([...availableExtras]);
      const selectedExtras = shuffledExtras.slice(0, slotsNeeded);
      keysToRender= shuffleArray([...requiredArray, ...selectedExtras])
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
// Initialize the register page if present.
const setupRegisterPage = () => {
  const form = document.getElementById("register-form");
  if (!form) return;

  //Admin logic
  const adminCondition = localStorage.getItem('hcs_experiment_condition');
  const fieldset = form.querySelector('fieldset'); // find <fieldset> tag in the register form
  const activeCondition = adminCondition || 'emoji'; //defalut to "digits"
  
  if (fieldset) {
    fieldset.style.display = 'none'; // hide the password type selection
    const targetRadio = form.querySelector(`input[name="password-type"][value=${activeCondition}]`);
    if (targetRadio) targetRadio.checked = true; // auto check this button
  }

  const participantInput = document.getElementById("participant-id");
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
    //id can't be spaces
    const isValid = participantInput.value.trim().length > 0; 
    generateBtn.disabled = !isValid;
  };

  if (participantInput && generateBtn) {
    participantInput.addEventListener("input", updateRegButtonState);
    
    //load once incase of autofill or if user went back a page
    updateRegButtonState(); 
  }

  //generates password DOES NOT SAVE
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const passwordType = formData.get("password-type");
    const participantId = (participantInput?.value || "").trim();

    const generatedPassword = passwordType === "emoji" ? randomEmojiPin() : randomDigitPin();
    pendingRegistration = {
      participant_id: participantId,
      password_type: passwordType,
      generated_password: generatedPassword,
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
    
    fillKeypad(passwordType, confirmKeypad, handleKey, generatedPassword);
  });

  confirmClearBtn.addEventListener("click", () => {
    confirmInput = [];
    renderConfirm();
  });

  //saves passcode after confirmation
  confirmForm.addEventListener("submit", (event) => {
    event.preventDefault();
    
    if (!pendingRegistration) return;

    const attempt = confirmInput.join("");
    
    if (attempt === pendingRegistration.generated_password) {
      // MATCH: Save to storage
      saveRegistration(pendingRegistration);
      
      confirmMessage.textContent = "Success! Account registered.";
      confirmMessage.className = "message success";
      goLoginBtn.disabled = false;
      
      confirmKeypad.innerHTML = ""; //shut down keypad, no typing after success
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
  if (event.key === 'hcs_admin_condition') {
    // once change in admin, refresh 
    window.location.reload();
  }
});
};

// Initialize the login page if present.
const setupLoginPage = () => {
  const panel = document.getElementById("login-panel");
  if (!panel) return;

  const keypad = document.getElementById("keypad");
  const inputDisplay = document.getElementById("input-display");
  const meta = document.getElementById("input-meta");
  const message = document.getElementById("message");
  const clearBtn = document.getElementById("clear");
  const loginBtn = document.getElementById("login");
  const hint = document.getElementById("login-hint");

  const registration = readRegistration();
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
  fillKeypad(passwordType, keypad, handleKey, storedPassword)

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

  loginBtn.addEventListener("click", () => {
    if (currentInput.length !== PIN_LENGTH) {
      showMessage(`Please enter ${PIN_LENGTH} characters`, "error");
      return;
    }
    const inputValue = currentInput.join("");
    if (inputValue === registration.generated_password) {
      saveLoginState(true);
      updatePageByLogin();
      showMessage("Login successful ✅", "success");
    } else {
      showMessage("Incorrect password, try again.", "error");
      clearAll();
    }
  });

  renderInput();
};

setupRegisterPage();
setupLoginPage();
updatePageByLogin();
updatePageByExperimentMode();
updateAdminPageByExperimentCondition();
updateAdminPageByExperimentStatus();

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