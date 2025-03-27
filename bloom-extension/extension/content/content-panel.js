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
const clearChatBtn = document.getElementById("bloom-clear-chat-btn");

// Tracking variables for streaming messages
let streamingMessageElement = null;
let streamingFullText = "";

// Custom confirmation dialog
function showConfirmDialog(message, onConfirm, onCancel) {
  const dialog = document.getElementById("bloom-confirm-dialog");
  const confirmMessage = document.getElementById("bloom-confirm-message");
  const okButton = document.getElementById("bloom-confirm-ok");
  const cancelButton = document.getElementById("bloom-confirm-cancel");

  // Set dialog message
  confirmMessage.textContent = message;

  // Show dialog
  dialog.style.display = "flex";

  // Handle OK button
  const handleOk = () => {
    dialog.style.display = "none";
    okButton.removeEventListener("click", handleOk);
    cancelButton.removeEventListener("click", handleCancel);
    if (onConfirm) onConfirm();
  };

  // Handle Cancel button
  const handleCancel = () => {
    dialog.style.display = "none";
    okButton.removeEventListener("click", handleOk);
    cancelButton.removeEventListener("click", handleCancel);
    if (onCancel) onCancel();
  };

  // Add event listeners
  okButton.addEventListener("click", handleOk);
  cancelButton.addEventListener("click", handleCancel);
}

// Helper function to escape HTML in code blocks
function escapeHTML(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/*
 * Markdown parser function with citation footnotes
 * plus the existing logic for code blocks, bold, italic, lists, etc.
 */
function parseMarkdown(text) {
  if (!text) return "";

  // ----------------------------------------------------------------
  // 1) Extract footnotes/citations into placeholders
  //    (Regex to catch parentheses that mention file/chunk references)
  // ----------------------------------------------------------------
  let citations = [];
  let citationIndex = 0;

  // Example: capturing references that mention "File.pdf", ".docx", "Chunk", etc.
  const citationRegex =
    /\(((?:[^()]+(?:File\.pdf|\.docx|\.pdf|Chunk|Chunks))[^()]*)\)/g;

  text = text.replace(citationRegex, function (match, captured) {
    // Store this citation text
    citations.push(captured);
    return `||FOOTNOTE_CITATION_${citationIndex++}||`;
  });

  // ----------------------------------------------------------------
  // 2) Continue with your existing Markdown transformations
  // ----------------------------------------------------------------

  // Handle code blocks with triple backticks
  text = text.replace(/```([\s\S]*?)```/g, function (match, code) {
    return "<pre><code>" + escapeHTML(code) + "</code></pre>";
  });

  // Handle inline code with single backticks
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

  // ----------------------------------------------------------------
  // 3) Handle lists more carefully to allow partial content
  //    (Unordered lists first)
  // ----------------------------------------------------------------
  let lines = text.split("\n");
  let inList = false;
  let listBuffer = "";

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().match(/^-\s+(.+)$/)) {
      if (!inList) {
        // start a new UL
        inList = true;
        listBuffer = "<ul>";
      }
      listBuffer +=
        "<li>" + lines[i].trim().replace(/^-\s+(.+)$/, "$1") + "</li>";
      lines[i] = "";
    } else if (inList && lines[i].trim() === "") {
      // empty line after a list => close it
      listBuffer += "</ul>";
      lines[i] = listBuffer;
      listBuffer = "";
      inList = false;
    }
  }
  // if we ended in a list, close it
  if (inList) {
    listBuffer += "</ul>";
    lines.push(listBuffer);
  }
  text = lines.filter((line) => line !== "").join("\n");

  // ----------------------------------------------------------------
  // 4) Ordered lists
  // ----------------------------------------------------------------
  lines = text.split("\n");
  inList = false;
  listBuffer = "";

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().match(/^\d+\.\s+(.+)$/)) {
      if (!inList) {
        inList = true;
        listBuffer = "<ol>";
      }
      listBuffer +=
        "<li>" + lines[i].trim().replace(/^\d+\.\s+(.+)$/, "$1") + "</li>";
      lines[i] = "";
    } else if (inList && lines[i].trim() === "") {
      listBuffer += "</ol>";
      lines[i] = listBuffer;
      listBuffer = "";
      inList = false;
    }
  }
  if (inList) {
    listBuffer += "</ol>";
    lines.push(listBuffer);
  }
  text = lines.filter((line) => line !== "").join("\n");

  // ----------------------------------------------------------------
  // 5) Handle paragraphs
  // ----------------------------------------------------------------
  let paragraphs = text.split(/\n\n+/);
  if (paragraphs.length > 1) {
    text = paragraphs.map((p) => (p.trim() ? `<p>${p}</p>` : "")).join("");
  } else {
    // If there's only one paragraph, replace single newlines with <br>
    text = `<p>${text.replace(/\n/g, "<br>")}</p>`;
  }

  // ----------------------------------------------------------------
  // 6) Insert footnotes at the bottom if any citations were found
  // ----------------------------------------------------------------
  let footnotesList = "";
  if (citations.length > 0) {
    // We'll store them as we see placeholders
    let finalIndex = 0;

    // Process academic-style footnote citations
    text = text.replace(/\|\|FOOTNOTE_CITATION_(\d+)\|\|/g, function (_m, idx) {
      const i = parseInt(idx, 10);
      footnotesList += `
            <div class="bloom-footnote-item">
              <span class="bloom-footnote-number">[${i + 1}]</span>
              <div>${citations[i]}</div>
            </div>
          `;
      finalIndex++;
      // Return a small marker in the text - modified to not add duplicate numbers
      return `<span class="bloom-footnote-citation">[${i + 1}]</span>`;
    });

    // If we built any footnotes, append them
    if (finalIndex > 0) {
      text += `<div class="bloom-footnotes">${footnotesList}</div>`;
    }
  }

  return text;
}

// ------------------------------------------------------------------
// Streaming logic for bot messages with real-time partial rendering
// ------------------------------------------------------------------
function streamMessage(element, text, index = 0, chunkSize = 4) {
  streamingMessageElement = element; // Track current streaming element

  if (index >= text.length) {
    // Done streaming, ensure final render is complete
    element.classList.remove("streaming");
    streamingMessageElement = null;
    streamingFullText = "";
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
  }, 15);

  // If we're on the last chunk, remove streaming class slightly later
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

// Clear chat button handler
clearChatBtn.addEventListener("click", () => {
  showConfirmDialog("Are you sure you want to clear the conversation?", () => {
    sendToParent("clearConversation");
  });
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

// Add message to chat with real-time Markdown streaming for bot
function addMessage(role, text) {
  // If there's already a message streaming, finalize it first
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
    // Stream bot messages
    streamMessage(messageDiv, text);
  } else {
    // Immediate render for user messages
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
