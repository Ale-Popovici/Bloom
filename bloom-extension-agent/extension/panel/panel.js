// BLOOM - Middlesex University Document Assistant
// Side Panel Script

document.addEventListener("DOMContentLoaded", function () {
  // DOM Elements
  const chatTab = document.getElementById("chat-tab");
  const docsTab = document.getElementById("docs-tab");
  const chatContent = document.getElementById("chat-content");
  const documentsContent = document.getElementById("documents-content");
  const messagesContainer = document.getElementById("bloom-messages");
  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");
  const uploadBtn = document.getElementById("upload-btn");
  const uploadDocBtn = document.getElementById("upload-doc-btn");
  const fileInput = document.getElementById("file-input");
  const documentList = document.getElementById("document-list");
  const settingsBtn = document.getElementById("settings-btn");
  const closeBtn = document.getElementById("close-btn");
  const settingsModal = document.getElementById("settings-modal");
  const closeSettingsBtn = document.getElementById("close-settings-btn");
  const apiUrlInput = document.getElementById("api-url");
  const clearHistoryBtn = document.getElementById("clear-history-btn");
  const sourcePreview = document.querySelector(".bloom-source-preview");
  const sourcesContainer = document.getElementById("bloom-sources");
  const hideSourcesBtn = document.getElementById("hide-sources-btn");
  const moduleSelect = document.getElementById("module-select");
  const clearChatBtn = document.getElementById("clear-chat-btn");

  // State
  let currentTab = "chat";
  let documents = [];
  let apiUrl = "http://localhost:8000";
  let sessionId = generateSessionId();
  let showingSources = false;
  let latestSources = [];
  let currentModule = ""; // For tracking selected module
  let streamingMessageElement = null; // To track the currently streaming message
  let streamingFullText = ""; // Buffer for the full text being streamed

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

  // Markdown parser function with citation footnotes
  function parseMarkdown(text) {
    if (!text) return "";

    // First, save any citations to process them separately
    let citations = [];
    let citationIndex = 0;

    // Regular expression to match citations in parentheses that mention files/chunks
    const citationRegex =
      /\(((?:[^()]+(?:File\.pdf|\.docx|\.pdf|Chunk|Chunks))[^()]*)\)/g;

    // Replace citations with placeholders
    text = text.replace(citationRegex, function (match, citation) {
      citations.push(citation);
      return `||FOOTNOTE_CITATION_${citationIndex++}||`;
    });

    // Handle headings (h1 to h6) - HANDLE THESE FIRST BEFORE OTHER PROCESSING
    text = text.replace(/^######\s+(.*?)$/gm, "<h6>$1</h6>");
    text = text.replace(/^#####\s+(.*?)$/gm, "<h5>$1</h5>");
    text = text.replace(/^####\s+(.*?)$/gm, "<h4>$1</h4>");
    text = text.replace(/^###\s+(.*?)$/gm, "<h3>$1</h3>");
    text = text.replace(/^##\s+(.*?)$/gm, "<h2>$1</h2>");
    text = text.replace(/^#\s+(.*?)$/gm, "<h1>$1</h1>");

    // Process standard markdown
    text = text.replace(/```([\s\S]*?)```/g, function (match, code) {
      return "<pre><code>" + escapeHTML(code) + "</code></pre>";
    });

    text = text.replace(/`([^`]+)`/g, function (match, code) {
      return "<code>" + escapeHTML(code) + "</code>";
    });

    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
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

    // Create footnotes list
    let footnotesList = "";

    // Process academic-style footnote citations
    // Fixed to prevent duplicate citation numbers
    text = text.replace(
      /\|\|FOOTNOTE_CITATION_(\d+)\|\|/g,
      function (match, index) {
        const i = parseInt(index);
        footnotesList += `<div class="bloom-footnote-item">
                <span class="bloom-footnote-number">[${i + 1}]</span>
                <div>${citations[i]}</div>
              </div>`;
        return `<span class="bloom-footnote-citation">[${i + 1}]</span>`;
      }
    );

    // Add footnotes list if we used the footnote style
    if (footnotesList) {
      text += `<div class="bloom-footnotes">${footnotesList}</div>`;
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

  // Initialize
  function initialize() {
    // Load saved API URL
    chrome.storage.local.get("apiUrl", function (data) {
      if (data.apiUrl) {
        apiUrl = data.apiUrl;
        apiUrlInput.value = apiUrl;
      }
    });

    // Add welcome message
    addBotMessage(
      "Hello! I'm BLOOM, your document assistant for Middlesex University. Upload course materials, and I'll help you find information quickly."
    );

    // Load documents
    loadDocuments();

    // Load available modules for the dropdown
    loadModules();

    // Initialize agent suggestions
    addAgentSuggestions();
  }

  // Load documents from storage
  function loadDocuments() {
    chrome.storage.local.get("documents", function (data) {
      if (data.documents && data.documents.length > 0) {
        documents = data.documents;
        renderDocuments();
      } else {
        // Show empty state
        documentList.innerHTML = `
                      <div class="bloom-empty-state">
                        <div class="bloom-empty-icon">📄</div>
                        <p>No documents yet</p>
                        <p class="bloom-empty-subtitle">Upload course materials to get started</p>
                      </div>
                    `;
      }
    });
  }

  // Load available modules
  async function loadModules() {
    try {
      const response = await fetch(`${apiUrl}/chat/modules`);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      // Clear existing options (except the default one)
      while (moduleSelect.options.length > 1) {
        moduleSelect.remove(1);
      }

      // Add module options to the dropdown
      if (data.modules && data.modules.length > 0) {
        data.modules.forEach((module) => {
          const option = document.createElement("option");
          option.value = module.code;
          option.textContent = module.code;
          moduleSelect.appendChild(option);
        });
      }
    } catch (error) {
      console.error("Error loading modules:", error);
    }
  }

  // Render documents in the list
  function renderDocuments(filteredDocs = null) {
    const docsToRender = filteredDocs || documents;

    if (docsToRender.length === 0) {
      documentList.innerHTML = `
                    <div class="bloom-empty-state">
                      <div class="bloom-empty-icon">📄</div>
                      <p>No documents yet</p>
                      <p class="bloom-empty-subtitle">Upload course materials to get started</p>
                    </div>
                  `;
      return;
    }

    documentList.innerHTML = "";

    docsToRender.forEach((doc) => {
      const docElement = document.createElement("div");
      docElement.className = "bloom-document";

      const date = doc.timestamp ? new Date(doc.timestamp) : new Date();
      const formattedDate =
        date.toLocaleDateString() + " " + date.toLocaleTimeString();

      docElement.innerHTML = `
                    <div class="bloom-document-info">
                      <div class="bloom-document-name">${doc.name}</div>
                      <div class="bloom-document-meta">Added: ${formattedDate}</div>
                    </div>
                    <div class="bloom-document-actions">
                      <button class="bloom-btn bloom-icon-btn bloom-secondary-btn bloom-delete-doc" data-id="${doc.id}" title="Delete Document">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  `;

      documentList.appendChild(docElement);
    });

    // Add event listeners to delete buttons
    document.querySelectorAll(".bloom-delete-doc").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const docId = e.currentTarget.getAttribute("data-id");
        deleteDocument(docId);
      });
    });
  }

  // Delete a document
  function deleteDocument(docId) {
    // Confirm deletion
    showConfirmDialog("Are you sure you want to delete this document?", () => {
      // Call API to delete document
      fetch(`${apiUrl}/documents/${docId}`, {
        method: "DELETE",
      })
        .then((response) => {
          if (response.ok) {
            // Remove from local storage
            documents = documents.filter((doc) => doc.id !== docId);
            chrome.storage.local.set({ documents });
            renderDocuments();
          } else {
            console.error("Failed to delete document");
          }
        })
        .catch((error) => {
          console.error("Error deleting document:", error);
        });
    });
  }

  // Generate a unique session ID
  function generateSessionId() {
    return (
      "bloom_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
    );
  }

  // Switch tabs
  function switchTab(tabName) {
    currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll(".bloom-tab").forEach((tab) => {
      tab.classList.remove("bloom-tab-active");
    });
    document
      .querySelector(`[data-tab="${tabName}"]`)
      .classList.add("bloom-tab-active");

    // Update tab content
    document.querySelectorAll(".bloom-tab-content").forEach((content) => {
      content.classList.remove("bloom-active");
    });

    if (tabName === "chat") {
      chatContent.classList.add("bloom-active");
    } else if (tabName === "documents") {
      documentsContent.classList.add("bloom-active");
    }
  }

  // Add a user message to the chat
  function addUserMessage(text) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "bloom-message bloom-user-message";
    // Apply Markdown formatting immediately for user messages
    messageDiv.innerHTML = parseMarkdown(text);

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
  }

  // Add a bot message to the chat with real-time Markdown streaming
  function addBotMessage(text) {
    // If there's already a message streaming, finalize it immediately
    if (streamingMessageElement) {
      streamingMessageElement.innerHTML = parseMarkdown(streamingFullText);
      streamingMessageElement.classList.remove("streaming");
      streamingMessageElement = null;
      streamingFullText = "";
    }

    const messageDiv = document.createElement("div");
    messageDiv.className = "bloom-message bloom-bot-message";

    // Check if this is an agent response (has special formatting)
    if (text.startsWith("[BLOOM Agent")) {
      messageDiv.classList.add("bloom-agent-message");

      // For agent messages, we don't use streaming to preserve formatting
      messageDiv.innerHTML = formatAgentResponse(text);
      messagesContainer.appendChild(messageDiv);
      scrollToBottom();
    } else {
      // Regular message - use streaming
      messagesContainer.appendChild(messageDiv);
      scrollToBottom();
      streamMessage(messageDiv, text);
    }
  }

  // Scroll chat to bottom
  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Send a message to the API
  async function sendMessage() {
    const message = chatInput.value.trim();

    if (!message) return;

    // Add user message to chat
    addUserMessage(message);

    // Clear input
    chatInput.value = "";

    // Show thinking indicator
    const thinkingDiv = document.createElement("div");
    thinkingDiv.className = "bloom-message bloom-bot-message bloom-thinking";
    thinkingDiv.innerHTML =
      'Thinking<span class="bloom-ellipsis"><span>.</span><span>.</span><span>.</span></span>';
    messagesContainer.appendChild(thinkingDiv);
    scrollToBottom();

    try {
      // Send request to API with the selected module
      const response = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: message,
          session_id: sessionId,
          module_code: currentModule, // Include the selected module
        }),
      });

      const data = await response.json();

      // Remove thinking indicator
      messagesContainer.removeChild(thinkingDiv);

      if (response.ok) {
        // Add bot response with real-time Markdown streaming
        addBotMessage(data.response);

        // Store sources
        if (data.sources && data.sources.length > 0) {
          latestSources = data.sources;
          updateSourcePreview();

          // Show sources if not already showing
          if (!showingSources) {
            toggleSourcePreview(true);
          }
        }
      } else {
        // Add error message
        addBotMessage("Sorry, I encountered an error. Please try again.");
        console.error("Chat error:", data.detail);
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

  // Update source preview with latest sources
  function updateSourcePreview() {
    sourcesContainer.innerHTML = "";

    latestSources.forEach((source) => {
      const sourceDiv = document.createElement("div");
      sourceDiv.className = "bloom-source";

      // Find document name from ID
      const document = documents.find((doc) => doc.id === source.document_id);
      const documentName = document ? document.name : "Unknown document";
      const moduleInfo = source.module_code ? ` (${source.module_code})` : "";

      sourceDiv.innerHTML = `
                    <div class="bloom-source-title">${documentName}${moduleInfo}</div>
                    <div class="bloom-source-text">Relevance: ${Math.round(
                      (1 - source.relevance) * 100
                    )}%</div>
                  `;

      sourcesContainer.appendChild(sourceDiv);
    });
  }

  // Toggle source preview visibility
  function toggleSourcePreview(show = null) {
    showingSources = show !== null ? show : !showingSources;

    if (showingSources) {
      sourcePreview.classList.add("bloom-active");
      hideSourcesBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 15L12 9L6 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  `;
    } else {
      sourcePreview.classList.remove("bloom-active");
      hideSourcesBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  `;
    }
  }

  // Add agent action suggestions beneath the chat input
  function addAgentSuggestions() {
    // Check if suggestions already exist
    if (document.querySelector(".bloom-agent-suggestions")) {
      return;
    }

    const inputContainer = document.querySelector(".bloom-input-container");

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
        document.getElementById("chat-input").value = suggestion;
        // Focus the input
        document.getElementById("chat-input").focus();
      });

      suggestionsDiv.appendChild(button);
    });

    // Insert before the input container
    chatContent.insertBefore(suggestionsDiv, inputContainer);
  }

  // Upload files
  function uploadFiles(files) {
    if (!files || files.length === 0) return;

    // Process each file
    Array.from(files).forEach(async (file) => {
      // Check file type
      if (
        !file.name.toLowerCase().endsWith(".pdf") &&
        !file.name.toLowerCase().endsWith(".docx")
      ) {
        addBotMessage(
          `Sorry, I can't process ${file.name}. Only PDF and DOCX files are supported.`
        );
        return;
      }

      // Show uploading message
      addBotMessage(`Uploading ${file.name}...`);

      // Create form data
      const formData = new FormData();
      formData.append("file", file);

      // Add module code if one is selected
      if (currentModule) {
        formData.append("module_code", currentModule);
      }

      try {
        // Upload file
        const response = await fetch(`${apiUrl}/documents/upload`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (response.ok) {
          // Add success message
          const moduleInfo = data.module_code
            ? ` to module ${data.module_code}`
            : "";
          addBotMessage(
            `Successfully processed ${file.name}${moduleInfo}. What would you like to know about it?`
          );

          // Add to documents list
          const newDoc = {
            id: data.document_id,
            name: file.name,
            timestamp: new Date().toISOString(),
            module_code: data.module_code,
          };

          documents.push(newDoc);
          chrome.storage.local.set({ documents });

          // Update documents tab
          renderDocuments();

          // Refresh module dropdown as new modules might have been created
          loadModules();
        } else {
          // Add error message
          addBotMessage(
            `Sorry, I couldn't process ${file.name}. Error: ${
              data.detail || "Unknown error"
            }`
          );
        }
      } catch (error) {
        // Add error message
        addBotMessage(
          `Sorry, I couldn't process ${file.name} due to a connection error.`
        );
        console.error("Upload error:", error);
      }
    });
  }

  // Event Listeners

  // Tab switching
  chatTab.addEventListener("click", () => switchTab("chat"));
  docsTab.addEventListener("click", () => switchTab("documents"));

  // Module dropdown
  moduleSelect.addEventListener("change", () => {
    currentModule = moduleSelect.value;
    // Add a helper message to indicate module switch
    if (currentModule) {
      addBotMessage(
        `Switched to module ${currentModule}. You can now ask questions about this module's content.`
      );
    } else {
      addBotMessage(
        "Switched to all documents mode. You can ask about any document in the system."
      );
    }

    // Filter documents list if in documents tab
    if (currentTab === "documents" && currentModule) {
      const filteredDocs = documents.filter(
        (doc) => doc.module_code === currentModule
      );
      renderDocuments(filteredDocs);
    } else if (currentTab === "documents") {
      renderDocuments();
    }
  });

  // Send message
  sendBtn.addEventListener("click", sendMessage);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  chatInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height =
      this.scrollHeight < 120 ? this.scrollHeight + "px" : "120px";
  });

  // Upload buttons
  uploadBtn.addEventListener("click", () => fileInput.click());
  uploadDocBtn.addEventListener("click", () => fileInput.click());

  // File input change
  fileInput.addEventListener("change", (e) => {
    uploadFiles(e.target.files);
    // Reset file input
    fileInput.value = "";
  });

  // Settings modal
  settingsBtn.addEventListener("click", () => {
    settingsModal.classList.add("bloom-active");
  });

  closeSettingsBtn.addEventListener("click", () => {
    settingsModal.classList.remove("bloom-active");

    // Save API URL if changed
    if (apiUrlInput.value !== apiUrl) {
      apiUrl = apiUrlInput.value;
      chrome.storage.local.set({ apiUrl });
    }
  });

  // Close button
  closeBtn.addEventListener("click", () => {
    // Send message to content script to close panel
    chrome.runtime.sendMessage({ action: "closePanel" });
  });

  // Clear history button in settings
  clearHistoryBtn.addEventListener("click", () => {
    showConfirmDialog(
      "Are you sure you want to clear the conversation?",
      async () => {
        try {
          // Call API to clear conversation
          const response = await fetch(`${apiUrl}/chat/clear`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              session_id: sessionId,
            }),
          });

          if (response.ok) {
            // Clear messages UI
            messagesContainer.innerHTML = "";

            // Add welcome message
            addBotMessage(
              "Chat history cleared. What would you like to know about your documents?"
            );

            // Hide sources
            toggleSourcePreview(false);

            // Close settings modal
            settingsModal.classList.remove("bloom-active");
          } else {
            console.error("Failed to clear chat history");
          }
        } catch (error) {
          console.error("Error clearing chat history:", error);
        }
      }
    );
  });

  // Clear chat button
  clearChatBtn.addEventListener("click", () => {
    showConfirmDialog(
      "Are you sure you want to clear the conversation?",
      async () => {
        try {
          // Call API to clear conversation
          const response = await fetch(`${apiUrl}/chat/clear`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              session_id: sessionId,
            }),
          });

          if (response.ok) {
            // Clear messages UI
            messagesContainer.innerHTML = "";

            // Add welcome message
            addBotMessage(
              "Chat history cleared. What would you like to know about your documents?"
            );

            // Hide sources
            toggleSourcePreview(false);

            // Reset conversation in local storage
            chrome.storage.local.set({ chatHistory: [] });
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
    );
  });

  // Toggle sources button
  hideSourcesBtn.addEventListener("click", () => {
    toggleSourcePreview();
  });

  // Drag and drop for documents tab
  documentsContent.addEventListener("dragover", (e) => {
    e.preventDefault();
    documentsContent.classList.add("bloom-drag-over");
  });

  documentsContent.addEventListener("dragleave", () => {
    documentsContent.classList.remove("bloom-drag-over");
  });

  documentsContent.addEventListener("drop", (e) => {
    e.preventDefault();
    documentsContent.classList.remove("bloom-drag-over");
    uploadFiles(e.dataTransfer.files);
  });

  // Initialize the panel
  initialize();
});
