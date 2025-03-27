// BLOOM - Panel-specific script that runs inside the iframe

// Communication with the parent window
function sendToParent(action, data = {}) {
  window.parent.postMessage({ action, ...data }, "*");
}

// DOM elements
const closeBtn = document.getElementById("bloom-close-panel");
const uploadBtn = document.getElementById("bloom-upload-btn");
const sendBtn = document.getElementById("bloom-send-btn");
const userInput = document.getElementById("bloom-user-input");
const moduleSelect = document.getElementById("bloom-module-select");
const messagesContainer = document.getElementById("bloom-chat-messages");

// Event listeners
closeBtn.addEventListener("click", () => {
  sendToParent("togglePanel");
});

uploadBtn.addEventListener("click", () => {
  sendToParent("openFilePicker");
});

sendBtn.addEventListener("click", () => {
  const message = userInput.value.trim();
  if (message) {
    sendToParent("sendMessage", { message });
    userInput.value = "";
  }
});

userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const message = userInput.value.trim();
    if (message) {
      sendToParent("sendMessage", { message });
      userInput.value = "";
    }
  }
});

// Module selector change handler
moduleSelect.addEventListener("change", () => {
  const selectedModule = moduleSelect.value;
  sendToParent("moduleChanged", { module: selectedModule });
});

// Listen for messages from parent window
window.addEventListener("message", (event) => {
  const data = event.data;

  switch (data.action) {
    case "addUserMessage":
      addMessage("user", data.text);
      break;
    case "addBotMessage":
      addMessage("bot", data.text);
      break;
    case "updateModules":
      updateModuleDropdown(data.modules);
      break;
    case "showThinking":
      showThinking();
      break;
    case "hideThinking":
      hideThinking();
      break;
    case "clearMessages":
      clearMessages();
      break;
  }
});

// Add message to chat
function addMessage(role, text) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `bloom-message bloom-${role}-message`;
  messageDiv.textContent = text;

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show thinking indicator
function showThinking() {
  const thinkingDiv = document.createElement("div");
  thinkingDiv.id = "bloom-thinking-indicator";
  thinkingDiv.className = "bloom-message bloom-bot-message bloom-thinking";
  thinkingDiv.innerHTML =
    'Thinking<span class="bloom-ellipsis"><span>.</span><span>.</span><span>.</span></span>';

  messagesContainer.appendChild(thinkingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Hide thinking indicator
function hideThinking() {
  const thinkingDiv = document.getElementById("bloom-thinking-indicator");
  if (thinkingDiv) {
    thinkingDiv.remove();
  }
}

// Clear all messages
function clearMessages() {
  messagesContainer.innerHTML = "";
}

// Update module dropdown options
function updateModuleDropdown(modules) {
  // Clear existing options (except the default one)
  while (moduleSelect.options.length > 1) {
    moduleSelect.remove(1);
  }

  // Add module options
  if (modules && modules.length > 0) {
    modules.forEach((module) => {
      const option = document.createElement("option");
      option.value = module.code;
      option.textContent = module.code;
      moduleSelect.appendChild(option);
    });
  }
}

// Initialize: tell parent window we're ready
window.addEventListener("DOMContentLoaded", () => {
  sendToParent("panelReady");
});
