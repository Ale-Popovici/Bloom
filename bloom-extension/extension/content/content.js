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

  // Set the source to our HTML file
  panelFrame.src = chrome.runtime.getURL("content/content.html");

  // Add to body
  document.body.appendChild(panelFrame);

  // Setup keyboard shortcut
  document.addEventListener("keydown", handleKeyboardShortcut);

  // Setup message listener to communicate with iframe
  window.addEventListener("message", handleIframeMessage);

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

// Send message to iframe
function sendToFrame(action, data = {}) {
  if (!panelFrame) return;

  panelFrame.contentWindow.postMessage({ action, ...data }, "*");
}

// Handle messages from iframe
function handleIframeMessage(event) {
  // Verify the origin is our iframe
  if (event.source !== panelFrame?.contentWindow) {
    // Handle messages from Moodle scraper or other content scripts
    handleContentScriptMessages(event);
    return;
  }

  const data = event.data;

  switch (data.action) {
    case "togglePanel":
      togglePanel();
      break;
    case "openFilePicker":
      openFilePicker();
      break;
    case "sendMessage":
      sendMessage(data.message);
      break;
    case "moduleChanged":
      handleModuleChange(data.module);
      break;
    case "panelReady":
      loadChatHistory();
      loadModules();
      break;
    case "clearConversation":
      clearConversation();
      break;
  }
}

// Handle messages from other content scripts (Moodle scraper)
function handleContentScriptMessages(event) {
  // Make sure message is from our window (the content script context)
  if (event.source === window) {
    const data = event.data;

    // Forward specific messages to the iframe
    if (
      data.action === "moodlePageCheckResult" ||
      data.action === "scrapingStartResult"
    ) {
      if (panelFrame) {
        // Forward the message to the iframe
        panelFrame.contentWindow.postMessage(data, "*");
      }
    }
  }
}

// Handle module change
function handleModuleChange(moduleCode) {
  const message = moduleCode
    ? `Switched to module ${moduleCode}. You can now ask questions about this module's content.`
    : "Switched to all documents mode. You can ask about any document in the system.";

  addBotMessage(message);
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
  // Get the selected module code
  const selectedModule = await getSelectedModule();

  // Add uploading message
  addBotMessage(
    `Uploading '${file.name}'${
      selectedModule ? ` to module ${selectedModule}` : ""
    }...`
  );

  // Prepare form data
  const formData = new FormData();
  formData.append("file", file);

  // Add module code if selected
  if (selectedModule) {
    formData.append("module_code", selectedModule);
  }

  try {
    // Upload the file
    const response = await fetch(`${API_URL}/documents/upload`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (response.ok) {
      // Add success message
      const moduleInfo = selectedModule ? ` to module ${selectedModule}` : "";
      addBotMessage(
        `I've processed '${file.name}'${moduleInfo}. What would you like to know about it?`
      );

      // Store document in local storage for tracking
      chrome.storage.local.get(["documents"], function (data) {
        const documents = data.documents || [];
        documents.push({
          id: result.document_id,
          name: file.name,
          module_code: selectedModule || null,
          timestamp: new Date().toISOString(),
        });
        chrome.storage.local.set({ documents });
      });

      // Refresh the module dropdown
      loadModules();
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

// Get the selected module from the iframe
function getSelectedModule() {
  return new Promise((resolve) => {
    // Create a unique ID for this request
    const requestId = Date.now().toString();

    // Create a function to handle the response
    const handleResponse = (event) => {
      const data = event.data;
      if (data.action === "moduleResponse" && data.requestId === requestId) {
        window.removeEventListener("message", handleResponse);
        resolve(data.module);
      }
    };

    // Listen for the response
    window.addEventListener("message", handleResponse);

    // Send the request
    sendToFrame("getSelectedModule", { requestId });

    // Timeout after 500ms in case there's no response
    setTimeout(() => {
      window.removeEventListener("message", handleResponse);
      resolve("");
    }, 500);
  });
}

// Add a user message to the chat
function addUserMessage(text) {
  if (!panelFrame) return;

  sendToFrame("addUserMessage", { text });

  // Save to chat history
  saveChatMessage("user", text);
}

// Add a bot message to the chat
function addBotMessage(text) {
  if (!panelFrame) return;

  sendToFrame("addBotMessage", { text });

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
    if (data.chatHistory && data.chatHistory.length > 0) {
      // Clear welcome message
      sendToFrame("clearMessages");

      // Add messages from history
      data.chatHistory.forEach((msg) => {
        sendToFrame(
          `add${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}Message`,
          { text: msg.content }
        );
      });
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

// Load available modules
async function loadModules() {
  try {
    const response = await fetch(`${API_URL}/chat/modules`);

    if (!response.ok) {
      console.error("Failed to load modules:", response.status);
      return;
    }

    const data = await response.json();

    // Send modules to iframe
    sendToFrame("updateModules", { modules: data.modules || [] });
  } catch (error) {
    console.error("Error loading modules:", error);
  }
}

// Send a message to the server and get a response
async function sendMessage(message) {
  if (!message) return;

  // Get the selected module code
  const selectedModule = await getSelectedModule();

  // Add user message to chat
  addUserMessage(message);

  // Show thinking indicator
  sendToFrame("showThinking");

  try {
    // Send message to server with module code if selected
    const response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: message,
        session_id: sessionId,
        module_code: selectedModule || undefined,
      }),
    });

    const result = await response.json();

    // Hide thinking indicator
    sendToFrame("hideThinking");

    if (response.ok) {
      // Add bot response - will be streamed in the panel
      addBotMessage(result.response);
    } else {
      // Add error message
      addBotMessage("Sorry, I encountered an error. Please try again.");
      console.error("Chat error:", result.detail);
    }
  } catch (error) {
    // Hide thinking indicator
    sendToFrame("hideThinking");

    // Add error message
    addBotMessage(
      "Sorry, I encountered an error. Please check your connection."
    );
    console.error("Chat error:", error);
  }
}

// Clear the conversation history
async function clearConversation() {
  try {
    // Call API to clear conversation
    const response = await fetch(`${API_URL}/chat/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
      }),
    });

    if (response.ok) {
      // Clear the chat history in storage
      chrome.storage.local.set({ chatHistory: [] });

      // Clear messages UI and add welcome message
      sendToFrame("clearMessages");
      addBotMessage(
        "Chat history cleared. What would you like to know about your documents?"
      );
    } else {
      console.error("Failed to clear chat history");
      addBotMessage(
        "Sorry, I couldn't clear the chat history. Please try again."
      );
    }
  } catch (error) {
    console.error("Error clearing chat history:", error);
    addBotMessage(
      "Sorry, I encountered an error trying to clear the chat history."
    );
  }
}

/**
 * Check if the current page is a Moodle course page and get module info
 */
function checkMoodlePage() {
  // Inject the Moodle scraper script if not already present
  injectMoodleScraperScript()
    .then(() => {
      // Wait for scraper to initialize
      const checkScraperReady = setInterval(() => {
        if (window.MoodleScraper && window.MoodleScraper.initialized) {
          clearInterval(checkScraperReady);

          // Check if it's a Moodle page
          const isMoodlePage = window.MoodleScraper.isMoodleCoursePage();

          if (isMoodlePage) {
            // Extract module info
            const moduleInfo = window.MoodleScraper.extractModuleInfo();

            // Send response back to iframe
            window.postMessage(
              {
                action: "moodlePageCheckResult",
                isMoodlePage: true,
                moduleCode: moduleInfo.moduleCode,
                moduleName: moduleInfo.moduleName,
              },
              "*"
            );
          } else {
            // Not a Moodle page
            window.postMessage(
              {
                action: "moodlePageCheckResult",
                isMoodlePage: false,
              },
              "*"
            );
          }
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkScraperReady);
        // Send failure response if scraper didn't initialize
        if (!window.MoodleScraper || !window.MoodleScraper.initialized) {
          window.postMessage(
            {
              action: "moodlePageCheckResult",
              isMoodlePage: false,
              error: "Failed to initialize scraper",
            },
            "*"
          );
        }
      }, 5000);
    })
    .catch((error) => {
      console.error("Error injecting Moodle scraper script:", error);
      window.postMessage(
        {
          action: "moodlePageCheckResult",
          isMoodlePage: false,
          error: "Failed to inject scraper",
        },
        "*"
      );
    });
}

/**
 * Start the scraping process for the current Moodle page
 */
function startScraping() {
  // Inject the Moodle scraper script if not already present
  injectMoodleScraperScript()
    .then(() => {
      // Wait for scraper to initialize
      const checkScraperReady = setInterval(() => {
        if (window.MoodleScraper && window.MoodleScraper.initialized) {
          clearInterval(checkScraperReady);

          // Start scraping
          window.MoodleScraper.startScraping()
            .then((result) => {
              // Send result back to iframe
              window.postMessage(
                {
                  action: "scrapingStartResult",
                  success: result.success,
                  taskId: result.taskId,
                  moduleCode: result.moduleCode,
                  moduleName: result.moduleName,
                  error: result.error,
                },
                "*"
              );
            })
            .catch((error) => {
              console.error("Error starting scraping:", error);
              window.postMessage(
                {
                  action: "scrapingStartResult",
                  success: false,
                  error: error.message || "Failed to start scraping",
                },
                "*"
              );
            });
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkScraperReady);
        // Send failure response if scraper didn't initialize
        if (!window.MoodleScraper || !window.MoodleScraper.initialized) {
          window.postMessage(
            {
              action: "scrapingStartResult",
              success: false,
              error: "Failed to initialize scraper",
            },
            "*"
          );
        }
      }, 5000);
    })
    .catch((error) => {
      console.error("Error injecting Moodle scraper script:", error);
      window.postMessage(
        {
          action: "scrapingStartResult",
          success: false,
          error: "Failed to inject scraper",
        },
        "*"
      );
    });
}

/**
 * Inject the Moodle scraper script into the page if not already present
 */
function injectMoodleScraperScript() {
  return new Promise((resolve, reject) => {
    // Check if scraper is already injected
    if (window.MoodleScraper) {
      resolve();
      return;
    }

    // Get the script URL
    const scriptURL = chrome.runtime.getURL("content/moodle_scraper.js");

    // Create script element
    const script = document.createElement("script");
    script.src = scriptURL;
    script.onload = () => {
      console.log("Moodle scraper script loaded");
      // Initialize scraper (give it a little time to set up)
      setTimeout(() => {
        if (window.MoodleScraper) {
          window.MoodleScraper.initialize()
            .then(() => resolve())
            .catch(reject);
        } else {
          reject(new Error("Moodle scraper not found after injection"));
        }
      }, 100);
    };
    script.onerror = () =>
      reject(new Error("Failed to load Moodle scraper script"));

    // Add to page
    document.head.appendChild(script);
  });
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
      sendToFrame("clearMessages");
      addBotMessage(
        "Chat history cleared. What would you like to know about your documents?"
      );
    }

    sendResponse({ success: true });
  } else if (message.action === "checkMoodlePage") {
    // New handler for checking if current page is a Moodle course page
    checkMoodlePage();
    // This will be async, so we'll send the response via postMessage
    sendResponse({ received: true });
  } else if (message.action === "startScraping") {
    // New handler for starting the scraping process
    startScraping();
    // This will be async, so we'll send the response via postMessage
    sendResponse({ received: true });
  }
  return true;
});
