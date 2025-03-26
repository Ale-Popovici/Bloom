// BLOOM - Middlesex University Assistant
// Popup script for extension functionality

document.addEventListener("DOMContentLoaded", function () {
  // DOM elements
  const welcomeScreen = document.getElementById("welcome-screen");
  const uploadScreen = document.getElementById("upload-screen");
  const processingScreen = document.getElementById("processing-screen");
  const getStartedBtn = document.getElementById("get-started-btn");
  const selectFilesBtn = document.getElementById("select-files-btn");
  const fileInput = document.getElementById("file-input");
  const fileList = document.getElementById("file-list");
  const uploadAllBtn = document.getElementById("upload-all-btn");
  const openChatBtn = document.getElementById("open-chat-btn");
  const openPanelBtn = document.getElementById("open-panel-btn");
  const dropArea = document.getElementById("drop-area");
  const statusDiv = document.getElementById("status");
  const progressFill = document.getElementById("progress-fill");
  const processingStatus = document.getElementById("processing-status");

  // API URL
  const API_URL = "http://localhost:8000";

  // State management
  let selectedFiles = [];
  let isFirstRun = true;

  // Initialize the popup
  function initialize() {
    // Check if it's the first run
    chrome.storage.local.get(["firstRun"], function (data) {
      isFirstRun = data.firstRun !== false;

      if (isFirstRun) {
        // Show welcome screen for first run
        welcomeScreen.classList.remove("hidden");
        uploadScreen.classList.add("hidden");
      } else {
        // Show upload screen for returning users
        welcomeScreen.classList.add("hidden");
        uploadScreen.classList.remove("hidden");
      }
    });
  }

  // Utility function to format file size
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  }

  // Add a file to the selected files list
  function addFileToList(file) {
    // Check if file is already in the list
    if (
      selectedFiles.some((f) => f.name === file.name && f.size === file.size)
    ) {
      return false;
    }

    // Add file to array
    selectedFiles.push(file);

    // Create file item element
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";
    fileItem.dataset.fileName = file.name;

    fileItem.innerHTML = `
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-size">${formatFileSize(file.size)}</div>
        </div>
        <div class="file-actions">
          <button class="file-remove" data-file="${file.name}">×</button>
        </div>
      `;

    // Add to DOM
    fileList.appendChild(fileItem);

    // Update upload button state
    uploadAllBtn.disabled = selectedFiles.length === 0;

    return true;
  }

  // Remove a file from the selected files list
  function removeFileFromList(fileName) {
    // Remove from array
    selectedFiles = selectedFiles.filter((file) => file.name !== fileName);

    // Remove from DOM
    const fileItem = fileList.querySelector(`[data-file-name="${fileName}"]`);
    if (fileItem) fileList.removeChild(fileItem);

    // Update upload button state
    uploadAllBtn.disabled = selectedFiles.length === 0;
  }

  // Upload all selected files
  async function uploadAllFiles() {
    if (selectedFiles.length === 0) return;

    // Show processing screen
    uploadScreen.classList.add("hidden");
    processingScreen.classList.remove("hidden");

    // Process each file
    let processed = 0;
    let successful = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const formData = new FormData();
      formData.append("file", file);

      // Update status
      processingStatus.textContent = `Processing ${file.name} (${i + 1}/${
        selectedFiles.length
      })`;
      progressFill.style.width = `${(i / selectedFiles.length) * 100}%`;

      try {
        // Upload file
        const response = await fetch(`${API_URL}/documents/upload`, {
          method: "POST",
          body: formData,
        });

        const result = await response.json();
        processed++;

        if (response.ok) {
          successful++;
          // Store document reference in extension storage
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
          console.error(`Error uploading ${file.name}:`, result.detail);
        }
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        processed++;
      }

      // Update progress
      progressFill.style.width = `${((i + 1) / selectedFiles.length) * 100}%`;
    }

    // Update status with results
    processingStatus.textContent = `Processed ${processed} documents, ${successful} successful`;
    progressFill.style.width = "100%";

    // Mark first run as complete
    chrome.storage.local.set({ firstRun: false });

    // Reset selected files
    selectedFiles = [];
    fileList.innerHTML = "";
    uploadAllBtn.disabled = true;

    // After short delay, check if we should open the panel
    setTimeout(() => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          // Try to open the side panel
          chrome.tabs
            .sendMessage(tabs[0].id, { action: "togglePanel" })
            .catch(() => {
              // If failed, show upload screen again
              processingScreen.classList.add("hidden");
              uploadScreen.classList.remove("hidden");
              statusDiv.textContent =
                "Documents processed. You can now open the chat panel.";
            });
        }
      });
    }, 1500);
  }

  // Event listeners

  // Get started button
  getStartedBtn.addEventListener("click", () => {
    welcomeScreen.classList.add("hidden");
    uploadScreen.classList.remove("hidden");
    chrome.storage.local.set({ firstRun: false });
  });

  // Select files button
  selectFilesBtn.addEventListener("click", () => {
    fileInput.click();
  });

  // File input change
  fileInput.addEventListener("change", () => {
    const files = fileInput.files;
    if (!files || files.length === 0) return;

    let newFilesAdded = 0;

    for (let i = 0; i < files.length; i++) {
      if (addFileToList(files[i])) {
        newFilesAdded++;
      }
    }

    // Reset file input so same file can be selected again
    fileInput.value = "";

    if (newFilesAdded > 0) {
      statusDiv.textContent = `${newFilesAdded} file(s) added. Click "Upload All" to process.`;
    } else {
      statusDiv.textContent = "No new files added.";
    }
  });

  // File remove buttons
  fileList.addEventListener("click", (e) => {
    if (e.target.classList.contains("file-remove")) {
      const fileName = e.target.getAttribute("data-file");
      removeFileFromList(fileName);
      statusDiv.textContent = `Removed ${fileName}`;
    }
  });

  // Upload all button
  uploadAllBtn.addEventListener("click", uploadAllFiles);

  // Open chat panel button
  openChatBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs
          .sendMessage(tabs[0].id, { action: "togglePanel" })
          .catch(() => {
            statusDiv.textContent =
              "Cannot open panel on this page. Try browsing to a web page first.";
          });
      }
    });
  });

  // Open panel button in footer
  openPanelBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs
          .sendMessage(tabs[0].id, { action: "togglePanel" })
          .catch(() => {
            statusDiv.textContent =
              "Cannot open panel on this page. Try browsing to a web page first.";
          });
      }
    });
  });

  // Drag and drop functionality
  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const highlight = () => {
    dropArea.classList.add("active");
  };

  const unhighlight = () => {
    dropArea.classList.remove("active");
  };

  const handleDrop = (e) => {
    preventDefaults(e);
    unhighlight();

    const dt = e.dataTransfer;
    const files = dt.files;

    if (!files || files.length === 0) return;

    let newFilesAdded = 0;

    for (let i = 0; i < files.length; i++) {
      // Only accept PDF and DOCX files
      if (
        files[i].name.toLowerCase().endsWith(".pdf") ||
        files[i].name.toLowerCase().endsWith(".docx")
      ) {
        if (addFileToList(files[i])) {
          newFilesAdded++;
        }
      }
    }

    if (newFilesAdded > 0) {
      statusDiv.textContent = `${newFilesAdded} file(s) added. Click "Upload All" to process.`;
    } else {
      statusDiv.textContent =
        "No valid files added. Only PDF and DOCX files are supported.";
    }
  };

  // Drag and drop event listeners
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropArea.addEventListener(eventName, highlight, false);
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });

  dropArea.addEventListener("drop", handleDrop, false);

  // Initialize the popup
  initialize();
});
