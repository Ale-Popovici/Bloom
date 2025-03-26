// BLOOM - Document Assistant for Middlesex University
// Content script with completely independent side panel

let panelFrame = null;
let isPanelOpen = false;
const API_URL = "http://localhost:8000";
let sessionId = generateSessionId();
const PANEL_WIDTH = 350; // Width of the panel in pixels

// Generate a unique session ID for conversation tracking
function generateSessionId() {
  return "bloom_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

// Create the BLOOM frame
function createPanel() {
  // Check if panel already exists
  if (document.getElementById("bloom-panel-frame")) {
    return;
  }

  // Create the iframe
  panelFrame = document.createElement("iframe");
  panelFrame.id = "bloom-panel-frame";
  panelFrame.className = "bloom-panel-frame bloom-panel-closed";

  // Set frame styles
  panelFrame.style.position = "fixed";
  panelFrame.style.top = "0";
  panelFrame.style.right = "0";
  panelFrame.style.width = PANEL_WIDTH + "px";
  panelFrame.style.height = "100vh";
  panelFrame.style.border = "none";
  panelFrame.style.boxShadow = "-2px 0 10px rgba(0, 0, 0, 0.1)";
  panelFrame.style.zIndex = "2147483647"; // Maximum z-index
  panelFrame.style.transform = "translateX(100%)";
  panelFrame.style.transition = "transform 0.3s ease";
  panelFrame.style.backgroundColor = "white";

  // Add to body
  document.body.appendChild(panelFrame);

  // Wait for iframe to load then inject content
  panelFrame.addEventListener("load", setupFrameContent);

  // Set empty initial content to trigger load event
  panelFrame.srcdoc = "<!DOCTYPE html><html><body></body></html>";

  // Setup keyboard shortcut
  document.addEventListener("keydown", handleKeyboardShortcut);

  // Show keyboard shortcut hint
  showShortcutHint();
}

// Handle keyboard shortcut
function handleKeyboardShortcut(e) {
  if (e.ctrlKey && e.shiftKey && e.key === "B") {
    togglePanel();
    e.preventDefault();
  }
}

// Show keyboard shortcut hint
function showShortcutHint() {
  const hint = document.createElement("div");
  hint.style.position = "fixed";
  hint.style.bottom = "20px";
  hint.style.right = "20px";
  hint.style.backgroundColor = "#2D2A4A";
  hint.style.color = "white";
  hint.style.padding = "10px 15px";
  hint.style.borderRadius = "5px";
  hint.style.fontSize = "14px";
  hint.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
  hint.style.zIndex = "2147483646";
  hint.style.animation = "fadeOut 5s forwards";
  hint.style.pointerEvents = "none";
  hint.textContent = "Press Ctrl+Shift+B to open BLOOM assistant";

  // Add style for animation
  const style = document.createElement("style");
  style.textContent = `
    @keyframes fadeOut {
      0% { opacity: 1; }
      70% { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  // Add hint to DOM
  document.body.appendChild(hint);

  // Remove after animation completes
  setTimeout(() => {
    if (hint.parentNode) {
      hint.parentNode.removeChild(hint);
    }
  }, 5000);
}

// Setup the content inside the iframe
function setupFrameContent() {
  // Get the iframe document
  const frameDoc =
    panelFrame.contentDocument || panelFrame.contentWindow.document;

  // Create panel HTML content
  const mdxPurple = "#2D2A4A"; // Default purple if unable to extract from page
  const mdxRed = "#D42E24"; // Middlesex University red

  // Add styles to the iframe
  frameDoc.head.innerHTML = `
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        margin: 0;
        padding: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        height: 100vh;
      }
      
      .bloom-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 15px;
        background-color: ${mdxPurple};
        color: white;
        height: 79px;
      }
      
      .bloom-logo-container {
        display: flex;
        flex-direction: column;
      }
      
      .bloom-logo-text {
        font-size: 20px;
        font-weight: bold;
        color: white;
      }
      
      .bloom-logo-subtitle {
        font-size: 12px;
        opacity: 0.9;
      }
      
      .bloom-close-btn {
        background: transparent;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
      }
      
      .bloom-panel-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .bloom-messages-container {
        flex: 1;
        overflow-y: auto;
        padding: 15px;
        background-color: #f9f9f9;
      }
      
      .bloom-message {
        margin-bottom: 10px;
        padding: 10px;
        border-radius: 10px;
        max-width: 85%;
        word-wrap: break-word;
      }
      
      .bloom-user-message {
        background-color: rgba(212, 46, 36, 0.1);
        align-self: flex-end;
        margin-left: auto;
        border-left: 3px solid ${mdxRed};
      }
      
      .bloom-bot-message {
        background-color: rgba(45, 42, 74, 0.1);
        align-self: flex-start;
        border-left: 3px solid ${mdxPurple};
      }
      
      .bloom-upload-area {
        padding: 10px 15px;
        border-top: 1px solid #eee;
      }
      
      .bloom-doc-list {
        max-height: 100px;
        overflow-y: auto;
        margin-bottom: 10px;
      }
      
      .bloom-doc-item {
        font-size: 12px;
        padding: 5px;
        background-color: #f1f1f1;
        border-radius: 3px;
        margin-bottom: 5px;
        display: flex;
        justify-content: space-between;
      }
      
      .bloom-input-area {
        display: flex;
        padding: 15px;
        border-top: 1px solid #eee;
      }
      
      .bloom-input {
        flex: 1;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 20px;
        outline: none;
      }
      
      .bloom-input:focus {
        border-color: ${mdxRed};
      }
      
      .bloom-btn {
        background-color: ${mdxRed};
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s;
      }
      
      .bloom-btn:hover {
        background-color: #b02520;
      }
      
      .bloom-upload-btn {
        width: 100%;
        margin-top: 5px;
      }
      
      .bloom-send-btn {
        margin-left: 10px;
        width: 40px;
        height: 40px;
        padding: 0;
      }
      
      .bloom-btn-icon {
        font-size: 18px;
      }
      
      /* Thinking animation */
      .bloom-thinking {
        display: flex;
        align-items: center;
      }

      .bloom-ellipsis span {
        opacity: 0;
        animation: bloomDot 1.4s infinite;
        margin-left: 2px;
      }

      .bloom-ellipsis span:nth-child(1) {
        animation-delay: 0s;
      }

      .bloom-ellipsis span:nth-child(2) {
        animation-delay: 0.2s;
      }

      .bloom-ellipsis span:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes bloomDot {
        0%, 60%, 100% { opacity: 0; }
        30% { opacity: 1; }
      }
    </style>
  `;

  // Add HTML content
  frameDoc.body.innerHTML = `
    <div class="bloom-panel-header">
      <div class="bloom-logo-container">
        <span class="bloom-logo-text">BLOOM</span>
        <span class="bloom-logo-subtitle">Middlesex University</span>
      </div>
      <button id="bloom-close-panel" class="bloom-close-btn" title="Close Panel (Ctrl+Shift+B)">×</button>
    </div>
    
    <div class="bloom-panel-content">
      <div id="bloom-chat-messages" class="bloom-messages-container">
        <div class="bloom-message bloom-bot-message">
          Hello! I'm BLOOM, your document assistant for Middlesex University. Upload course materials, and I'll help you find information quickly.
        </div>
      </div>
      
      <div class="bloom-upload-area">
        <div id="bloom-doc-list" class="bloom-doc-list"></div>
        <button id="bloom-upload-btn" class="bloom-btn bloom-upload-btn">
          <span class="bloom-btn-icon">+</span> Upload Documents
        </button>
      </div>
      
      <div class="bloom-input-area">
        <input type="text" id="bloom-user-input" class="bloom-input" placeholder="Ask about your documents...">
        <button id="bloom-send-btn" class="bloom-btn bloom-send-btn">
          <span class="bloom-btn-icon">↑</span>
        </button>
      </div>
    </div>
  `;

  // Setup event handlers in the iframe
  frameDoc.getElementById("bloom-close-panel").addEventListener("click", () => {
    window.parent.postMessage({ action: "togglePanel" }, "*");
  });

  frameDoc.getElementById("bloom-upload-btn").addEventListener("click", () => {
    window.parent.postMessage({ action: "openFilePicker" }, "*");
  });

  frameDoc.getElementById("bloom-send-btn").addEventListener("click", () => {
    const input = frameDoc.getElementById("bloom-user-input");
    const message = input.value.trim();
    if (message) {
      window.parent.postMessage(
        { action: "sendMessage", message: message },
        "*"
      );
      input.value = "";
    }
  });

  frameDoc
    .getElementById("bloom-user-input")
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const input = frameDoc.getElementById("bloom-user-input");
        const message = input.value.trim();
        if (message) {
          window.parent.postMessage(
            { action: "sendMessage", message: message },
            "*"
          );
          input.value = "";
        }
      }
    });

  // Setup message event listener in the parent window
  window.addEventListener("message", handleIframeMessage);

  // Load chat history from storage
  loadChatHistory();
}

// Toggle panel visibility
function togglePanel() {
  if (!panelFrame) {
    createPanel();
    setTimeout(() => togglePanel(), 100);
    return;
  }

  isPanelOpen = !isPanelOpen;

  if (isPanelOpen) {
    panelFrame.classList.remove("bloom-panel-closed");
    panelFrame.classList.add("bloom-panel-open");
    panelFrame.style.transform = "translateX(0)";
  } else {
    panelFrame.classList.remove("bloom-panel-open");
    panelFrame.classList.add("bloom-panel-closed");
    panelFrame.style.transform = "translateX(100%)";
  }

  // Store panel state
  chrome.storage.local.set({ isPanelOpen: isPanelOpen });
}

// Handle messages from iframe
function handleIframeMessage(event) {
  const data = event.data;

  if (data.action === "togglePanel") {
    togglePanel();
  } else if (data.action === "openFilePicker") {
    openFilePicker();
  } else if (data.action === "sendMessage") {
    sendMessage(data.message);
  }
}

// Open file picker for document upload
function openFilePicker() {
  // Create a hidden file input element
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".pdf,.docx";
  fileInput.multiple = true; // Allow multiple file selection
  fileInput.style.display = "none";

  // Add to DOM
  document.body.appendChild(fileInput);

  // Handle file selection
  fileInput.addEventListener("change", async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Process each selected file
    for (let i = 0; i < files.length; i++) {
      await uploadDocument(files[i]);
    }

    // Remove the file input from DOM
    document.body.removeChild(fileInput);
  });

  // Open the file picker
  fileInput.click();
}

// Upload a document to the server
async function uploadDocument(file) {
  // Add uploading message
  addBotMessage(`Uploading '${file.name}'...`);

  // Prepare form data
  const formData = new FormData();
  formData.append("file", file);

  try {
    // Upload the file
    const response = await fetch(`${API_URL}/documents/upload`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (response.ok) {
      // Add success message
      addBotMessage(
        `I've processed '${file.name}'. What would you like to know about it?`
      );

      // Store document in local storage for tracking
      chrome.storage.local.get(["documents"], function (data) {
        const documents = data.documents || [];
        documents.push({
          id: result.document_id,
          name: file.name,
          timestamp: new Date().toISOString(),
        });
        chrome.storage.local.set({ documents });
      });
    } else {
      // Add error message
      addBotMessage(
        `Sorry, I couldn't process '${file.name}'. Error: ${
          result.detail || "Unknown error"
        }`
      );
    }
  } catch (error) {
    // Add error message
    addBotMessage(
      `Sorry, I couldn't process '${file.name}'. Please check your connection.`
    );
    console.error("Upload error:", error);
  }
}

// Add a user message to the chat
function addUserMessage(text) {
  if (!panelFrame) return;

  const frameDoc =
    panelFrame.contentDocument || panelFrame.contentWindow.document;
  const messagesContainer = frameDoc.getElementById("bloom-chat-messages");

  if (!messagesContainer) return;

  const messageDiv = frameDoc.createElement("div");
  messageDiv.className = "bloom-message bloom-user-message";
  messageDiv.textContent = text;

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Save to chat history
  saveChatMessage("user", text);
}

// Add a bot message to the chat
function addBotMessage(text) {
  if (!panelFrame) return;

  const frameDoc =
    panelFrame.contentDocument || panelFrame.contentWindow.document;
  const messagesContainer = frameDoc.getElementById("bloom-chat-messages");

  if (!messagesContainer) return;

  const messageDiv = frameDoc.createElement("div");
  messageDiv.className = "bloom-message bloom-bot-message";
  messageDiv.textContent = text;

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Save to chat history
  saveChatMessage("bot", text);
}

// Save chat message to history
function saveChatMessage(role, content) {
  chrome.storage.local.get(["chatHistory"], function (data) {
    const chatHistory = data.chatHistory || [];
    chatHistory.push({ role, content });
    chrome.storage.local.set({ chatHistory });
  });
}

// Load chat history from storage
function loadChatHistory() {
  chrome.storage.local.get(["chatHistory", "sessionId"], function (data) {
    if (data.chatHistory && data.chatHistory.length > 0 && panelFrame) {
      const frameDoc =
        panelFrame.contentDocument || panelFrame.contentWindow.document;
      const messagesContainer = frameDoc.getElementById("bloom-chat-messages");

      if (!messagesContainer) return;

      // Clear welcome message
      messagesContainer.innerHTML = "";

      // Add messages from history
      data.chatHistory.forEach((msg) => {
        const messageDiv = frameDoc.createElement("div");
        messageDiv.className = `bloom-message bloom-${msg.role}-message`;
        messageDiv.textContent = msg.content;
        messagesContainer.appendChild(messageDiv);
      });

      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Use stored session ID if available
    if (data.sessionId) {
      sessionId = data.sessionId;
    } else {
      // Store new session ID
      chrome.storage.local.set({ sessionId });
    }
  });
}

// Send a message to the server and get a response
async function sendMessage(message) {
  if (!message) return;

  // Add user message to chat
  addUserMessage(message);

  // Show thinking indicator
  const frameDoc =
    panelFrame.contentDocument || panelFrame.contentWindow.document;
  const messagesContainer = frameDoc.getElementById("bloom-chat-messages");

  const thinkingDiv = frameDoc.createElement("div");
  thinkingDiv.className = "bloom-message bloom-bot-message bloom-thinking";
  thinkingDiv.innerHTML =
    'Thinking<span class="bloom-ellipsis"><span>.</span><span>.</span><span>.</span></span>';

  messagesContainer.appendChild(thinkingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    // Send message to server
    const response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: message,
        session_id: sessionId,
      }),
    });

    const result = await response.json();

    // Remove thinking indicator
    messagesContainer.removeChild(thinkingDiv);

    if (response.ok) {
      // Add bot response
      addBotMessage(result.response);
    } else {
      // Add error message
      addBotMessage("Sorry, I encountered an error. Please try again.");
      console.error("Chat error:", result.detail);
    }
  } catch (error) {
    // Remove thinking indicator
    if (thinkingDiv.parentNode) {
      messagesContainer.removeChild(thinkingDiv);
    }

    // Add error message
    addBotMessage(
      "Sorry, I encountered an error. Please check your connection."
    );
    console.error("Chat error:", error);
  }
}

// Initialize the panel
function initialize() {
  // Create the panel
  createPanel();

  // Check if panel should be open based on previous state
  chrome.storage.local.get(["isPanelOpen"], function (data) {
    if (data.isPanelOpen) {
      setTimeout(() => {
        togglePanel();
      }, 300);
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "togglePanel") {
    togglePanel();
    sendResponse({ success: true });
  } else if (message.action === "checkPanel") {
    sendResponse({ exists: !!panelFrame });
  } else if (message.action === "clearHistory") {
    chrome.storage.local.set({ chatHistory: [] });

    if (panelFrame) {
      const frameDoc =
        panelFrame.contentDocument || panelFrame.contentWindow.document;
      const messagesContainer = frameDoc.getElementById("bloom-chat-messages");

      if (messagesContainer) {
        messagesContainer.innerHTML = "";
        addBotMessage(
          "Chat history cleared. What would you like to know about your documents?"
        );
      }
    }

    sendResponse({ success: true });
  }
  return true;
});
