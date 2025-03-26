// BLOOM - Document Assistant for Middlesex University
// Background script for extension functionality

// Initialize when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log("BLOOM for Middlesex University installed");

  // Set default configuration
  chrome.storage.local.set({
    apiUrl: "http://localhost:8000",
    isPanelOpen: false,
    documents: [],
    firstRun: true,
  });
});

// Add the extension icon to browser toolbar
chrome.action.setIcon({
  path: {
    16: "assets/icons/favicon.ico",
    48: "assets/icons/icon-192.png",
    128: "assets/icons/icon-512.png",
  },
});

// Keep service worker alive
const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20e3);
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive();

// Handle click on extension icon
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Check if the current page is compatible
    const isValidPage =
      tab.url.startsWith("http") || tab.url.startsWith("https");

    if (!isValidPage) {
      // Display a notification or popup if not a valid page
      await chrome.action.setPopup({ popup: "popup/popup.html" });
      await chrome.action.openPopup();
      return;
    }

    // Check if current tab has BLOOM panel
    const [response] = await chrome.tabs
      .sendMessage(tab.id, {
        action: "checkPanel",
      })
      .catch(() => [{ exists: false }]);

    if (response && response.exists) {
      // If panel exists, toggle its visibility
      chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
    } else {
      // If panel doesn't exist, inject content script and then open panel
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/content.js"],
      });

      // Small delay to ensure content script is fully loaded
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
      }, 100);
    }
  } catch (error) {
    console.error("Error handling extension click:", error);

    // Fall back to popup if content script injection fails
    await chrome.action.setPopup({ popup: "popup/popup.html" });
    await chrome.action.openPopup();
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getApiUrl") {
    // Provide the API URL to content script
    chrome.storage.local.get("apiUrl", (data) => {
      sendResponse({ apiUrl: data.apiUrl || "http://localhost:8000" });
    });
    return true; // Indicates async response
  }

  if (message.action === "updateDocuments") {
    // Update document list in storage
    chrome.storage.local.get("documents", (data) => {
      const documents = data.documents || [];

      if (message.operation === "add") {
        documents.push(message.document);
      } else if (message.operation === "remove") {
        const index = documents.findIndex(
          (doc) => doc.id === message.documentId
        );
        if (index !== -1) {
          documents.splice(index, 1);
        }
      }

      chrome.storage.local.set({ documents });
      sendResponse({ success: true });
    });
    return true; // Indicates async response
  }

  if (message.action === "openPopup") {
    // Open the popup when needed
    chrome.action.setPopup({ popup: "popup/popup.html" });
    chrome.action.openPopup();
    sendResponse({ success: true });
    return true;
  }
});

// Handle commands (keyboard shortcuts)
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle_panel") {
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        // Send toggle message to content script
        chrome.tabs.sendMessage(tabs[0].id, { action: "togglePanel" });
      }
    });
  }
});

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "bloom_search") {
    // Send selected text to BLOOM for search
    const selectedText = info.selectionText;

    if (selectedText) {
      chrome.tabs.sendMessage(tab.id, {
        action: "searchText",
        text: selectedText,
      });
    }
  }
});

// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "bloom_search",
    title: "Search in BLOOM",
    contexts: ["selection"],
  });
});
