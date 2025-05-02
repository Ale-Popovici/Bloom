// BLOOM - Middlesex University Assistant
// Popup script for extension functionality

document.addEventListener("DOMContentLoaded", function () {
  // DOM elements - Original Document Upload
  const welcomeScreen = document.getElementById("welcome-screen");
  const uploadScreen = document.getElementById("upload-screen");
  const processingScreen = document.getElementById("processing-screen");
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

  // DOM elements - New tab navigation
  const tabButtons = document.querySelectorAll(".bloom-tab");
  const tabContents = document.querySelectorAll(".tab-content");

  // DOM elements - Scraper
  const notMoodleState = document.getElementById("not-moodle-state");
  const readyState = document.getElementById("ready-state");
  const processingState = document.getElementById("processing-state");
  const completeState = document.getElementById("complete-state");
  const errorState = document.getElementById("error-state");

  // Scraper UI elements
  const moduleCode = document.getElementById("module-code");
  const moduleName = document.getElementById("module-name");
  const startScrapingBtn = document.getElementById("start-scraping-btn");
  const scraperProgressFill = document.getElementById("progress-fill");
  const filesFound = document.getElementById("files-found");
  const filesDownloaded = document.getElementById("files-downloaded");
  const resultModuleCode = document.getElementById("result-module-code");
  const resultFilesCount = document.getElementById("result-files-count");
  const viewDocumentsBtn = document.getElementById("view-documents-btn");
  const openChatAfterScrapeBtn = document.getElementById(
    "open-chat-after-scrape-btn"
  );
  const retryBtn = document.getElementById("retry-btn");
  const errorMessage = document.getElementById("error-message");

  // API URL
  const API_URL = "http://localhost:8000";

  // State management
  let selectedFiles = [];
  let isFirstRun = true;
  let currentScrapingTaskId = null;
  let pollingInterval = null;

  // Initialize the popup
  function initialize() {
    // Check if it's the first run
    chrome.storage.local.get(["firstRun"], function (data) {
      isFirstRun = data.firstRun !== false;
    });

    // Check if we're on a Moodle page
    checkMoodlePage();
  }

  // Tab navigation
  function setupTabs() {
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        // Deactivate all tabs
        tabButtons.forEach((btn) => btn.classList.remove("active"));
        tabContents.forEach((content) => content.classList.remove("active"));

        // Activate the clicked tab
        button.classList.add("active");
        const tabName = button.getAttribute("data-tab");
        document.getElementById(tabName + "-screen").classList.add("active");

        // If switching to scraper tab, check Moodle page status
        if (tabName === "scraper") {
          checkMoodlePage();
        }
      });
    });
  }

  // Check if current page is a Moodle course page
  function checkMoodlePage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        showScraperState("not-moodle");
        return;
      }

      const currentTab = tabs[0];
      const url = currentTab.url;

      // Check if URL is a Moodle course page
      if (
        url &&
        url.includes("mdx.mrooms.net") &&
        url.includes("/course/view.php") &&
        url.includes("id=")
      ) {
        // It's a Moodle page, inject content script if not already
        chrome.scripting
          .executeScript({
            target: { tabId: currentTab.id },
            func: extractModuleInfo,
          })
          .then((results) => {
            if (results && results.length > 0 && results[0].result) {
              const moduleInfo = results[0].result;
              // Show ready state with module info
              moduleCode.textContent = moduleInfo.moduleCode;
              moduleName.textContent = moduleInfo.moduleName;
              showScraperState("ready");
            } else {
              showScraperState("not-moodle");
            }
          })
          .catch((error) => {
            console.error("Error executing script:", error);
            showScraperState("not-moodle");
          });
      } else {
        // Not a Moodle page
        showScraperState("not-moodle");
      }
    });
  }

  // Function to be injected into the page to extract module info
  function extractModuleInfo() {
    // Default module code (fallback)
    let moduleCode = "MDX_MODULE";
    let moduleName = document.title || "Middlesex Module";

    // Try to extract from breadcrumb
    const breadcrumbs = document.querySelectorAll(
      ".breadcrumb a, .breadcrumb li"
    );
    for (const crumb of breadcrumbs) {
      const text = crumb.textContent.trim();

      // Look for module code pattern (e.g., CST3350)
      const codeMatch = text.match(/([A-Z]{2,4}\d{4})/);
      if (codeMatch) {
        moduleCode = codeMatch[1];
      }

      // Get the last breadcrumb as the module name
      if (!crumb.querySelector("a")) {
        moduleName = text;
      }
    }

    // Try to extract from page header if not found in breadcrumbs
    if (moduleCode === "MDX_MODULE") {
      const header = document.querySelector(".page-header-headings h1");
      if (header) {
        const headerText = header.textContent.trim();

        // Look for module code pattern
        const codeMatch = headerText.match(/([A-Z]{2,4}\d{4})/);
        if (codeMatch) {
          moduleCode = codeMatch[1];

          // Module name is everything after the code
          const nameMatch = headerText.match(/[A-Z]{2,4}\d{4}\s+(.*)/);
          if (nameMatch) {
            moduleName = nameMatch[1].trim();
          }
        } else {
          // Use the whole header as module name
          moduleName = headerText;
        }
      }
    }

    return { moduleCode, moduleName };
  }

  // Show the appropriate scraper state
  function showScraperState(state) {
    // Hide all states
    notMoodleState.classList.add("hidden");
    readyState.classList.add("hidden");
    processingState.classList.add("hidden");
    completeState.classList.add("hidden");
    errorState.classList.add("hidden");

    // Show the requested state
    switch (state) {
      case "not-moodle":
        notMoodleState.classList.remove("hidden");
        break;
      case "ready":
        readyState.classList.remove("hidden");
        break;
      case "processing":
        processingState.classList.remove("hidden");
        break;
      case "complete":
        completeState.classList.remove("hidden");
        break;
      case "error":
        errorState.classList.remove("hidden");
        break;
    }
  }

  // Start the scraping process
  function startScraping() {
    showScraperState("processing");

    // Reset progress indicators
    scraperProgressFill.style.width = "0%";
    filesFound.textContent = "0";
    filesDownloaded.textContent = "0";

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        showScraperError("No active tab found");
        return;
      }

      const currentTab = tabs[0];

      // Execute script to get module info and cookies
      chrome.scripting
        .executeScript({
          target: { tabId: currentTab.id },
          func: getMoodleData,
        })
        .then((results) => {
          if (!results || results.length === 0 || !results[0].result) {
            showScraperError("Failed to extract data from Moodle page");
            return;
          }

          const data = results[0].result;

          // Call API to start scraping
          fetch(`${API_URL}/scraper/start`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: currentTab.url,
              module_code: data.moduleInfo.moduleCode,
              module_name: data.moduleInfo.moduleName,
              cookies: data.cookies,
            }),
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
              }
              return response.json();
            })
            .then((result) => {
              // Store task ID for polling
              currentScrapingTaskId = result.task_id;

              // Start polling for status
              startStatusPolling(result.task_id);
            })
            .catch((error) => {
              showScraperError(`Failed to start scraping: ${error.message}`);
            });
        })
        .catch((error) => {
          showScraperError(`Error executing script: ${error.message}`);
        });
    });
  }

  // Function to be injected into the page to get data for scraping
  function getMoodleData() {
    // Get module info
    const moduleInfo = {
      moduleCode: "MDX_MODULE",
      moduleName: document.title || "Middlesex Module",
    };

    // Try to extract from breadcrumb
    const breadcrumbs = document.querySelectorAll(
      ".breadcrumb a, .breadcrumb li"
    );
    for (const crumb of breadcrumbs) {
      const text = crumb.textContent.trim();

      const codeMatch = text.match(/([A-Z]{2,4}\d{4})/);
      if (codeMatch) {
        moduleInfo.moduleCode = codeMatch[1];
      }

      if (!crumb.querySelector("a")) {
        moduleInfo.moduleName = text;
      }
    }

    // Try to extract from page header
    if (moduleInfo.moduleCode === "MDX_MODULE") {
      const header = document.querySelector(".page-header-headings h1");
      if (header) {
        const headerText = header.textContent.trim();

        const codeMatch = headerText.match(/([A-Z]{2,4}\d{4})/);
        if (codeMatch) {
          moduleInfo.moduleCode = codeMatch[1];

          const nameMatch = headerText.match(/[A-Z]{2,4}\d{4}\s+(.*)/);
          if (nameMatch) {
            moduleInfo.moduleName = nameMatch[1].trim();
          }
        } else {
          moduleInfo.moduleName = headerText;
        }
      }
    }

    // Get cookies
    const cookies = {};
    document.cookie.split(";").forEach((cookie) => {
      const parts = cookie.trim().split("=");
      if (parts.length === 2) {
        cookies[parts[0]] = parts[1];
      }
    });

    return { moduleInfo, cookies };
  }

  // Start polling for scraping status
  function startStatusPolling(taskId) {
    // Clear existing interval if any
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    // Function to check status
    const checkStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/scraper/status/${taskId}`);

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const status = await response.json();

        // Update progress display
        updateScraperProgress(status);

        // Check if finished
        if (status.status === "completed") {
          clearInterval(pollingInterval);
          pollingInterval = null;
          showScrapingComplete(status);

          // Refresh documents list
          chrome.storage.local.get(["documents"], (data) => {
            // We don't need to do anything with the result here
            console.log("Documents updated:", data.documents?.length || 0);
          });
        } else if (status.status === "failed") {
          clearInterval(pollingInterval);
          pollingInterval = null;
          showScraperError(
            status.errors && status.errors.length > 0
              ? status.errors[0]
              : "Failed to complete scraping"
          );
        }
      } catch (error) {
        console.error("Error checking scraping status:", error);
      }
    };

    // Check immediately
    checkStatus();

    // Then check every 2 seconds
    pollingInterval = setInterval(checkStatus, 2000);
  }

  // Update the progress display based on status
  function updateScraperProgress(status) {
    // Update progress bar
    scraperProgressFill.style.width = `${status.progress}%`;

    // Update file counts
    filesFound.textContent = status.files_found || 0;
    filesDownloaded.textContent = status.files_downloaded || 0;
  }

  // Show completion state
  function showScrapingComplete(status) {
    resultModuleCode.textContent = status.module_code;
    resultFilesCount.textContent = status.files_downloaded;
    showScraperState("complete");
  }

  // Show error state with message
  function showScraperError(message) {
    errorMessage.textContent = message;
    showScraperState("error");
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
    const documentsScreen = document.getElementById("documents-screen");
    documentsScreen.classList.remove("active");
    processingScreen.classList.add("active");

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
              processingScreen.classList.remove("active");
              documentsScreen.classList.add("active");
              statusDiv.textContent =
                "Documents processed. You can now open the chat panel.";
            });
        }
      });
    }, 1500);
  }

  // Event listeners

  // Tab navigation
  setupTabs();

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

  // Scraper event listeners
  startScrapingBtn.addEventListener("click", startScraping);

  retryBtn.addEventListener("click", () => {
    // Re-check Moodle page
    checkMoodlePage();
  });

  viewDocumentsBtn.addEventListener("click", () => {
    // Switch to documents tab
    document.querySelector('.bloom-tab[data-tab="documents"]').click();
  });

  openChatAfterScrapeBtn.addEventListener("click", () => {
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

  // Initialize the popup
  initialize();
});
