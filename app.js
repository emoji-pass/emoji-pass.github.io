// Handles registration/login flow, PIN generation, input UI, and localStorage state.
const PIN_LENGTH = 4;
const MAX_EMOJI_REPEAT = 2;
const EMOJI_LIST = ["😀", "😁", "😂", "🤣", "😅", "😊", "😎", "😍", "😘", "🤔", "😴", "😡", "🤯", "🥳", "😈", "🤖"];

const STORAGE_KEY = "hcs_emoji_auth";

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

// Format input display: dots for digits, emojis for emoji mode.
const formatInputDisplay = (inputArray, passwordType) => {
  if (passwordType === "emoji") return inputArray.length ? inputArray.join("") : "----";
  if (inputArray.length === 0) return "----";
  return "●".repeat(inputArray.length);
};

// Update the small length counter under the input display.
const updateLengthMeta = (metaEl, length) => {
  if (!metaEl) return;
  metaEl.textContent = `Length ${length} / ${PIN_LENGTH}`;
};

// Initialize the register page if present.
const setupRegisterPage = () => {
  const form = document.getElementById("register-form");
  if (!form) return;

  const participantInput = document.getElementById("participant-id");
  const resultPanel = document.getElementById("result");
  const passwordDisplay = document.getElementById("generated-password");
  const goLoginBtn = document.getElementById("go-login");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const passwordType = formData.get("password-type");
    const participantId = (participantInput?.value || "").trim();

    const generatedPassword = passwordType === "emoji" ? randomEmojiPin() : randomDigitPin();
    const registration = {
      participant_id: participantId,
      password_type: passwordType,
      generated_password: generatedPassword,
      created_at: new Date().toISOString(),
    };

    saveRegistration(registration);
    passwordDisplay.textContent = generatedPassword;
    resultPanel.classList.remove("hidden");
    goLoginBtn.disabled = false;
  });

  goLoginBtn.addEventListener("click", () => {
    window.location.href = "login.html";
  });
};

// Create a keypad button and bind it to an input handler.
const createKeyButton = (label, onClick) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.addEventListener("click", () => onClick(label));
  return btn;
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

  const passwordType = registration.password_type || "digits";
  let currentInput = [];

  const renderInput = () => {
    inputDisplay.textContent = formatInputDisplay(currentInput, passwordType);
    updateLengthMeta(meta, currentInput.length);
  };

  const pushInput = (value) => {
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

  if (passwordType === "emoji") {
    hint.textContent = "Log in using the emoji password you registered.";
    EMOJI_LIST.forEach((emoji) => keypad.appendChild(createKeyButton(emoji, pushInput)));
  } else {
    hint.textContent = "Log in using the digits PIN you registered.";
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    digits.forEach((digit) => keypad.appendChild(createKeyButton(digit, pushInput)));
  }

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
