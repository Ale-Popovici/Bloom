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

// Complete parseMarkdown function with table support for content-panel.js
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
  // 2) Handle headings first (before other transformations)
  // ----------------------------------------------------------------

  // Handle headings (h1 to h6)
  text = text.replace(/^######\s+(.*?)$/gm, "<h6>$1</h6>");
  text = text.replace(/^#####\s+(.*?)$/gm, "<h5>$1</h5>");
  text = text.replace(/^####\s+(.*?)$/gm, "<h4>$1</h4>");
  text = text.replace(/^###\s+(.*?)$/gm, "<h3>$1</h3>");
  text = text.replace(/^##\s+(.*?)$/gm, "<h2>$1</h2>");
  text = text.replace(/^#\s+(.*?)$/gm, "<h1>$1</h1>");

  // ----------------------------------------------------------------
  // 3) Handle tables with scrollable container
  // ----------------------------------------------------------------
  text = text.replace(
    /^\|(.+)\|\s*\n\|[-:\s|]+\|\s*\n((^\|.+\|\s*\n)+)/gm,
    function (match, headerRow, bodyRows) {
      // Process the header row
      const headers = headerRow
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell !== "");

      // Create the HTML header row with container for scrolling
      let tableHTML =
        '<div class="bloom-md-table-container"><table class="bloom-md-table"><thead><tr>';
      headers.forEach((header) => {
        tableHTML += `<th>${header}</th>`;
      });
      tableHTML += "</tr></thead><tbody>";

      // Process body rows
      const rows = bodyRows.trim().split("\n");
      rows.forEach((row) => {
        const cells = row
          .split("|")
          .map((cell) => cell.trim())
          .filter((cell) => cell !== "");

        tableHTML += "<tr>";
        cells.forEach((cell) => {
          tableHTML += `<td>${cell}</td>`;
        });
        tableHTML += "</tr>";
      });

      tableHTML += "</tbody></table></div>";
      return tableHTML;
    }
  );

  // ----------------------------------------------------------------
  // 4) Continue with your existing Markdown transformations
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
  // 5) Handle lists more carefully to allow partial content
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
  // 6) Ordered lists
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
  // 7) Handle paragraphs
  // ----------------------------------------------------------------
  let paragraphs = text.split(/\n\n+/);
  if (paragraphs.length > 1) {
    text = paragraphs.map((p) => (p.trim() ? `<p>${p}</p>` : "")).join("");
  } else {
    // If there's only one paragraph, replace single newlines with <br>
    text = `<p>${text.replace(/\n/g, "<br>")}</p>`;
  }

  // ----------------------------------------------------------------
  // 8) Insert footnotes at the bottom if any citations were found
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

// Function to detect and format agent responses
function formatAgentResponse(text) {
  // Check if this is an agent response (starts with the agent tag)
  if (text.startsWith("[BLOOM Agent")) {
    const titleEndIndex = text.indexOf("]\n\n");
    if (titleEndIndex > 0) {
      const agentTitle = text.substring(0, titleEndIndex + 1);
      const agentContent = text.substring(titleEndIndex + 3);

      // Format with special styling for agent responses
      return `<div class="bloom-agent-header">${agentTitle}</div>
                  <div class="bloom-agent-content">${parseMarkdown(
                    agentContent
                  )}</div>`;
    }
  }

  // Regular message - use normal markdown parsing
  return parseMarkdown(text);
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

// Add agent action suggestions beneath the chat input
function addAgentSuggestions() {
  // Check if suggestions already exist
  if (document.querySelector(".bloom-agent-suggestions")) {
    return;
  }

  const messagesContainer = document.getElementById("bloom-chat-messages");
  const inputArea = document.querySelector(".bloom-input-area");

  // Create suggestion container
  const suggestionsDiv = document.createElement("div");
  suggestionsDiv.className = "bloom-agent-suggestions";
  suggestionsDiv.innerHTML = "<span>Try agent actions: </span>";

  // Add suggestion buttons
  const suggestions = [
    "Summarize this document",
    "Extract key points from these materials",
    "Create a study guide for this topic",
    "Compare these documents",
  ];

  suggestions.forEach((suggestion) => {
    const button = document.createElement("span");
    button.className = "bloom-agent-suggestion";
    button.textContent = suggestion;
    button.addEventListener("click", () => {
      // Set the suggestion as input text
      document.getElementById("bloom-user-input").value = suggestion;
      // Focus the input
      document.getElementById("bloom-user-input").focus();
    });

    suggestionsDiv.appendChild(button);
  });

  // Insert before the input container
  if (inputArea && inputArea.parentNode) {
    inputArea.parentNode.insertBefore(suggestionsDiv, inputArea);
  }
}

// Modified function to handle both regular and agent messages
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

  if (role === "bot" && text.startsWith("[BLOOM Agent")) {
    // For agent messages, add special class and don't stream
    messageDiv.classList.add("bloom-agent-message");
    messageDiv.innerHTML = formatAgentResponse(text);
    messagesContainer.appendChild(messageDiv);
  } else if (role === "bot") {
    // Regular bot message - use streaming
    messagesContainer.appendChild(messageDiv);
    streamMessage(messageDiv, text);
  } else {
    // User message - immediate render
    messageDiv.innerHTML = parseMarkdown(text);
    messagesContainer.appendChild(messageDiv);
  }

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
  // Add agent suggestions
  addAgentSuggestions();

  // Tell parent we're ready
  sendToParent("panelReady");
});
