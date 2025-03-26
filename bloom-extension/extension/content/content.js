// BLOOM - Document Assistant for Middlesex University
// Content script for injecting the integrated side panel

let sidePanel = null;
let isPanelOpen = false;
const API_URL = "http://localhost:8000";
let sessionId = generateSessionId();
let chatHistory = [];

// Generate a unique session ID for conversation tracking
function generateSessionId() {
  return "bloom_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

// Create and inject the side panel into the current page
function createSidePanel() {
  // Create the panel container - but NOT inside the page wrapper
  // This keeps it completely separate from page content
  sidePanel = document.createElement("div");
  sidePanel.id = "bloom-side-panel";
  sidePanel.classList.add("bloom-panel-closed");

  // Create panel HTML structure
  sidePanel.innerHTML = `
    <div class="bloom-panel-header">
      <div class="bloom-logo-container">
        <span class="bloom-logo-text">BLOOM</span>
        <span class="bloom-logo-subtitle">Middlesex University</span>
      </div>
      <button id="bloom-toggle-panel" class="bloom-toggle-btn">
        <span class="bloom-toggle-icon">›</span>
      </button>
    </div>
    
    <div class="bloom-panel-content">
      <div id="bloom-chat-messages" class="bloom-messages-container"></div>
      
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

  // Create a wrapper for page content - this allows us to shift content
  createPageWrapper();

  // Add panel DIRECTLY to body, not inside the page wrapper
  // This ensures it remains completely separate
  document.body.appendChild(sidePanel);

  // Load and inject styles
  injectStyles();

  // Add event listeners
  setupEventListeners();

  // Load chat history from storage
  loadChatHistory();

  // Send welcome message if no history exists
  if (chatHistory.length === 0) {
    addBotMessage(
      "Hello! I'm BLOOM, your document assistant for Middlesex University. Upload course materials, and I'll help you find information quickly."
    );
  }
}

// Create a wrapper around the entire page content
function createPageWrapper() {
  // Check if wrapper already exists
  if (document.getElementById("bloom-page-wrapper")) {
    return;
  }

  // Create wrapper element
  const wrapper = document.createElement("div");
  wrapper.id = "bloom-page-wrapper";
  wrapper.className = "bloom-page-wrapper";

  // Create content container
  const contentContainer = document.createElement("div");
  contentContainer.id = "bloom-content-container";
  contentContainer.className = "bloom-content-container";

  // Move all body children to the content container
  while (document.body.firstChild) {
    contentContainer.appendChild(document.body.firstChild);
  }

  // Add content container to wrapper
  wrapper.appendChild(contentContainer);

  // Add wrapper to body
  document.body.appendChild(wrapper);

  // Create toggle button outside the panel
  const toggleButton = document.createElement("button");
  toggleButton.id = "bloom-floating-toggle";
  toggleButton.className = "bloom-floating-toggle bloom-btn";
  toggleButton.innerHTML = `
    <span>B</span>
    <span class="bloom-tooltip">Open BLOOM Assistant</span>
  `;
  document.body.appendChild(toggleButton);

  // Add click event to toggle button
  toggleButton.addEventListener("click", togglePanel);
}

// Inject the required styles for the side panel
function injectStyles() {
  // Extract Middlesex purple color from the university header
  const mdxPurple = getMiddlesexPurpleColor() || "#2D2A4A"; // Fallback color

  const style = document.createElement("style");
  style.textContent = `
    /* Middlesex University styling */
    :root {
      --mdx-red: #D42E24;
      --mdx-red-light: #f9d7d5;
      --mdx-red-dark: #b02520;
      --mdx-purple: ${mdxPurple};
      --mdx-purple-light: #e9ddff;
      --text-dark: #333333;
      --text-light: #ffffff;
      --bg-light: #ffffff;
      --bg-grey: #f5f5f5;
      --border-color: #e0e0e0;
    }
    
    /* Reset body styles to enable our layout */
    body {
      margin: 0 !important;
      padding: 0 !important;
      overflow-x: hidden !important;
    }
    
    /* Page wrapper layout */
    .bloom-page-wrapper {
      width: 100%;
      min-height: 100vh;
      position: relative;
      transition: all 0.3s ease;
    }
    
    /* Main content container */
    .bloom-content-container {
      transition: width 0.3s ease, margin-right 0.3s ease;
      width: 100%;
    }
    
    /* When panel is open */
    body.bloom-panel-open .bloom-content-container {
      width: calc(100% - 350px);
      margin-right: 350px;
    }
    
    /* Side panel - completely separate with own scrolling */
    #bloom-side-panel {
      position: fixed;
      top: 0;
      right: 0;
      width: 350px;
      height: 100vh;
      background-color: white;
      box-shadow: -5px 0 15px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      transition: transform 0.3s ease;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      overflow: hidden; /* Prevent overflow */
    }
    
    .bloom-panel-closed {
      transform: translateX(350px);
    }
    
    .bloom-panel-open {
      transform: translateX(0);
    }
    
    /* Match the Middlesex header style but double the height */
    .bloom-panel-header {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 0 15px;
      background-color: var(--mdx-purple); /* Middlesex University purple */
      color: white;
      height: 79px; 
    }
    
    .bloom-logo-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    
    .bloom-logo-text {
      font-size: 26px; /* Increased font size */
      font-weight: bold;
      color: white; /* White text instead of purple */
      letter-spacing: 1px;
    }
    
    .bloom-logo-subtitle {
      font-size: 14px; /* Increased font size */
      opacity: 0.9;
      color: white;
      margin-top: 5px;
    }
    
    .bloom-toggle-btn {
      background: transparent;
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border-radius: 50%;
      position: absolute;
      left: -40px;
      top: 25px; /* Center vertically in larger header */
      background-color: var(--mdx-purple);
      box-shadow: -3px 0 5px rgba(0, 0, 0, 0.1);
    }
    
    .bloom-toggle-icon {
      transform: rotate(180deg);
      display: inline-block;
    }
    
    /* Panel content - with its own scrolling */
    .bloom-panel-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden; /* Important - ensures separate scrolling */
    }
    
    .bloom-messages-container {
      flex: 1;
      overflow-y: auto; /* Independent scrolling */
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
      border-left: 3px solid var(--mdx-red);
    }
    
    .bloom-bot-message {
      background-color: rgba(45, 42, 74, 0.1);
      align-self: flex-start;
      border-left: 3px solid var(--mdx-purple);
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
      border-color: var(--mdx-red);
    }
    
    .bloom-btn {
      background-color: var(--mdx-red);
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
      background-color: var(--mdx-red-dark);
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
    
    /* Floating toggle button */
    .bloom-floating-toggle {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background-color: var(--mdx-red);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      z-index: 9999;
      transition: all 0.2s ease;
    }
    
    .bloom-floating-toggle:hover {
      background-color: var(--mdx-red-dark);
      transform: scale(1.05);
    }
    
    .bloom-tooltip {
      position: absolute;
      right: 60px;
      background-color: #333;
      color: white;
      padding: 5px 10px;
      border-radius: 5px;
      font-size: 12px;
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transition: all 0.2s ease;
    }
    
    .bloom-floating-toggle:hover .bloom-tooltip {
      opacity: 1;
      visibility: visible;
    }
    
    /* Hide the floating toggle when panel is open */
    body.bloom-panel-open .bloom-floating-toggle {
      opacity: 0;
      visibility: hidden;
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
  `;

  document.head.appendChild(style);
}

// Try to extract the Middlesex purple color from the university header
function getMiddlesexPurpleColor() {
  try {
    // Look for the Middlesex header
    const mdxHeader = document.querySelector(
      "header, #header, .header, nav, .nav, .navbar"
    );
    if (mdxHeader) {
      const computedStyle = window.getComputedStyle(mdxHeader);
      return computedStyle.backgroundColor || "#2D2A4A";
    }
    return null;
  } catch (e) {
    console.error("Error getting Middlesex color:", e);
    return null;
  }
}

// Set up event listeners for the panel
function setupEventListeners() {
  // Toggle panel visibility
  document
    .getElementById("bloom-toggle-panel")
    .addEventListener("click", togglePanel);

  // Open file picker when upload button is clicked
  document
    .getElementById("bloom-upload-btn")
    .addEventListener("click", openFilePicker);

  // Send message when button is clicked or Enter is pressed
  document
    .getElementById("bloom-send-btn")
    .addEventListener("click", sendMessage);
  document
    .getElementById("bloom-user-input")
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendMessage();
    });
}

// Toggle the side panel visibility
function togglePanel() {
  isPanelOpen = !isPanelOpen;

  if (isPanelOpen) {
    // Open the panel
    sidePanel.classList.remove("bloom-panel-closed");
    sidePanel.classList.add("bloom-panel-open");
    document.body.classList.add("bloom-panel-open");
    document
      .getElementById("bloom-toggle-panel")
      .querySelector(".bloom-toggle-icon").style.transform = "rotate(0deg)";
  } else {
    // Close the panel
    sidePanel.classList.remove("bloom-panel-open");
    sidePanel.classList.add("bloom-panel-closed");
    document.body.classList.remove("bloom-panel-open");
    document
      .getElementById("bloom-toggle-panel")
      .querySelector(".bloom-toggle-icon").style.transform = "rotate(180deg)";
  }

  // Store panel state
  chrome.storage.local.set({ isPanelOpen: isPanelOpen });
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
  // Display a temporary item in the document list
  const docId = `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const docItem = createDocumentListItem(docId, file.name, "Uploading...");
  document.getElementById("bloom-doc-list").appendChild(docItem);

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
      // Update document list item to show success
      updateDocumentListItem(docId, file.name, "Processed", "success");
      // Add confirmation message in chat
      addBotMessage(
        `I've processed '${file.name}'. What would you like to know about it?`
      );
    } else {
      // Update document list item to show error
      updateDocumentListItem(docId, file.name, "Failed", "error");
      console.error("Upload error:", result.detail);
    }
  } catch (error) {
    // Update document list item to show error
    updateDocumentListItem(docId, file.name, "Failed", "error");
    console.error("Upload error:", error);
  }
}

// Create a document list item
function createDocumentListItem(id, filename, status) {
  const item = document.createElement("div");
  item.id = id;
  item.className = "bloom-doc-item";
  item.innerHTML = `
    <span class="bloom-doc-name">${filename}</span>
    <span class="bloom-doc-status">${status}</span>
  `;
  return item;
}

// Update a document list item
function updateDocumentListItem(id, filename, status, statusType) {
  const item = document.getElementById(id);
  if (!item) return;

  item.innerHTML = `
    <span class="bloom-doc-name">${filename}</span>
    <span class="bloom-doc-status ${
      statusType === "error" ? "bloom-status-error" : "bloom-status-success"
    }">${status}</span>
  `;
}

// Load chat history from storage
function loadChatHistory() {
  chrome.storage.local.get(["chatHistory", "sessionId"], function (data) {
    if (data.chatHistory && data.chatHistory.length > 0) {
      chatHistory = data.chatHistory;

      // Render previous messages
      const messagesContainer = document.getElementById("bloom-chat-messages");
      messagesContainer.innerHTML = "";

      chatHistory.forEach((msg) => {
        const messageDiv = document.createElement("div");
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
      chrome.storage.local.set({ sessionId: sessionId });
    }
  });
}

// Save chat history to storage
function saveChatHistory() {
  chrome.storage.local.set({
    chatHistory: chatHistory,
    sessionId: sessionId,
  });
}

// Add a user message to the chat
function addUserMessage(text) {
  const messageDiv = document.createElement("div");
  messageDiv.className = "bloom-message bloom-user-message";
  messageDiv.textContent = text;

  const messagesContainer = document.getElementById("bloom-chat-messages");
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Add to chat history
  chatHistory.push({
    role: "user",
    content: text,
  });

  // Save chat history
  saveChatHistory();
}

// Add a bot message to the chat
function addBotMessage(text) {
  const messageDiv = document.createElement("div");
  messageDiv.className = "bloom-message bloom-bot-message";
  messageDiv.textContent = text;

  const messagesContainer = document.getElementById("bloom-chat-messages");
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Add to chat history
  chatHistory.push({
    role: "bot",
    content: text,
  });

  // Save chat history
  saveChatHistory();
}

// Send a message to the server and get a response
async function sendMessage() {
  const input = document.getElementById("bloom-user-input");
  const message = input.value.trim();

  if (!message) return;

  // Add user message to chat
  addUserMessage(message);

  // Clear input
  input.value = "";

  // Show thinking indicator
  const thinkingDiv = document.createElement("div");
  thinkingDiv.className = "bloom-message bloom-bot-message bloom-thinking";
  thinkingDiv.innerHTML =
    'Thinking<span class="bloom-ellipsis"><span>.</span><span>.</span><span>.</span></span>';

  const messagesContainer = document.getElementById("bloom-chat-messages");
  messagesContainer.appendChild(thinkingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    // Send message to server with session ID for conversation memory
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
      // Add bot response to chat
      addBotMessage(result.response);
    } else {
      // Add error message
      addBotMessage(
        "Sorry, I encountered an error processing your request. Please try again."
      );
      console.error("Chat error:", result.detail);
    }
  } catch (error) {
    // Remove thinking indicator
    messagesContainer.removeChild(thinkingDiv);

    // Add error message
    addBotMessage(
      "Sorry, I encountered an error. Please check your connection and try again."
    );
    console.error("Chat error:", error);
  }
}

// Initialize the side panel when the page is fully loaded
if (document.readyState === "complete") {
  createSidePanel();

  // Check if panel should be open
  chrome.storage.local.get(["isPanelOpen"], function (data) {
    if (data.isPanelOpen) {
      setTimeout(togglePanel, 100);
    }
  });
} else {
  window.addEventListener("load", function () {
    createSidePanel();

    // Check if panel should be open
    chrome.storage.local.get(["isPanelOpen"], function (data) {
      if (data.isPanelOpen) {
        setTimeout(togglePanel, 100);
      }
    });
  });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "togglePanel") {
    if (sidePanel) {
      togglePanel();
    } else {
      createSidePanel();
      setTimeout(togglePanel, 100);
    }
    sendResponse({ success: true });
  } else if (message.action === "checkPanel") {
    sendResponse({ exists: !!sidePanel });
  } else if (message.action === "clearHistory") {
    chatHistory = [];
    saveChatHistory();

    // Clear messages in UI
    const messagesContainer = document.getElementById("bloom-chat-messages");
    if (messagesContainer) {
      messagesContainer.innerHTML = "";
      addBotMessage(
        "Chat history cleared. What would you like to know about your documents?"
      );
    }

    sendResponse({ success: true });
  }
  return true;
});
