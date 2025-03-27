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

// Tracking variables for streaming messages
let streamingMessageElement = null;
let streamingFullText = "";

// Helper function to escape HTML in code blocks
function escapeHTML(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Markdown parser function with improved handling for partial content
function parseMarkdown(text) {
  if (!text) return "";

  // Handle code blocks with ```
  text = text.replace(/```([\s\S]*?)```/g, function (match, code) {
    return "<pre><code>" + escapeHTML(code) + "</code></pre>";
  });

  // Handle inline code with backticks - prevent parsing markdown inside code
  text = text.replace(/`([^`]+)`/g, function (match, code) {
    return "<code>" + escapeHTML(code) + "</code>";
  });

  // Handle bold
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Handle italic
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Handle links
  text = text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank">$1</a>'
  );

  // Handle unordered lists - more careful handling for partial content
  let lines = text.split("\n");
  let inList = false;
  let listBuffer = "";

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().match(/^-\s+(.+)$/)) {
      if (!inList) {
        // Start a new list
        inList = true;
        listBuffer = "<ul>";
      }

      // Add this list item
      listBuffer +=
        "<li>" + lines[i].trim().replace(/^-\s+(.+)$/, "$1") + "</li>";
      lines[i] = "";
    } else if (inList && lines[i].trim() === "") {
      // Empty line after list - close the list
      listBuffer += "</ul>";
      lines[i] = listBuffer;
      listBuffer = "";
      inList = false;
    }
  }

  // If we're still in a list at the end, close it
  if (inList) {
    listBuffer += "</ul>";
    lines.push(listBuffer);
  }

  // Reassemble lines
  text = lines.filter((line) => line !== "").join("\n");

  // Handle ordered lists
  lines = text.split("\n");
  inList = false;
  listBuffer = "";

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().match(/^\d+\.\s+(.+)$/)) {
      if (!inList) {
        // Start a new list
        inList = true;
        listBuffer = "<ol>";
      }

      // Add this list item
      listBuffer +=
        "<li>" + lines[i].trim().replace(/^\d+\.\s+(.+)$/, "$1") + "</li>";
      lines[i] = "";
    } else if (inList && lines[i].trim() === "") {
      // Empty line after list - close the list
      listBuffer += "</ol>";
      lines[i] = listBuffer;
      listBuffer = "";
      inList = false;
    }
  }

  // If we're still in a list at the end, close it
  if (inList) {
    listBuffer += "</ol>";
    lines.push(listBuffer);
  }

  // Reassemble lines
  text = lines.filter((line) => line !== "").join("\n");

  // Handle paragraphs - if content is partial, this might not work perfectly
  // but it will continuously improve as more content arrives
  let paragraphs = text.split(/\n\n+/);
  if (paragraphs.length > 1) {
    text = paragraphs.map((p) => (p.trim() ? `<p>${p}</p>` : "")).join("");
  } else {
    // Single paragraph - handle newlines as line breaks
    text = `<p>${text.replace(/\n/g, "<br>")}</p>`;
  }

  return text;
}

// Stream message function with real-time Markdown rendering
function streamMessage(element, text, index = 0, chunkSize = 4) {
  streamingMessageElement = element; // Track current streaming element

  if (index >= text.length) {
    // Done streaming, ensure final render is complete
    element.classList.remove("streaming");
    streamingMessageElement = null; // Clear tracking
    streamingFullText = ""; // Reset the buffer
    return;
  }

  // Add the next chunk to our buffer
  const chunk = text.substring(index, index + chunkSize);
  streamingFullText += chunk;

  // Apply markdown to the entire text buffer and update the element
  element.innerHTML = parseMarkdown(streamingFullText);

  // Add the streaming class for subtle animation
  element.classList.add("streaming");

  // Auto-scroll to the bottom while streaming
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Schedule the next chunk with a small delay
  setTimeout(() => {
    streamMessage(element, text, index + chunkSize, chunkSize);
  }, 15); // Slightly longer delay to ensure smooth rendering

  // If we're on the last chunk, remove the streaming animation class
  if (index + chunkSize >= text.length) {
    setTimeout(() => {
      element.classList.remove("streaming");
    }, 300);
  }
}

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
    case "getSelectedModule":
      // Reply with the currently selected module
      window.parent.postMessage(
        {
          action: "moduleResponse",
          requestId: data.requestId,
          module: moduleSelect.value,
        },
        "*"
      );
      break;
  }
});

// Add message to chat with real-time Markdown
function addMessage(role, text) {
  // If there's already a message streaming, complete it immediately
  if (streamingMessageElement) {
    streamingMessageElement.innerHTML = parseMarkdown(streamingFullText);
    streamingMessageElement.classList.remove("streaming");
    streamingMessageElement = null;
    streamingFullText = "";
  }

  const messageDiv = document.createElement("div");
  messageDiv.className = `bloom-message bloom-${role}-message`;

  messagesContainer.appendChild(messageDiv);

  if (role === "bot") {
    // Stream bot messages with real-time Markdown
    streamMessage(messageDiv, text);
  } else {
    // For user messages, apply markdown immediately
    messageDiv.innerHTML = parseMarkdown(text);
  }

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show thinking indicator
function showThinking() {
  // Remove any existing thinking indicator first
  hideThinking();

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
