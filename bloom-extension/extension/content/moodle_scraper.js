// BLOOM - Moodle Scraper Module
// Enhanced version to handle special types of links and folder traversal

class MoodleScraper {
  constructor() {
    this.API_URL = "http://localhost:8000"; // This will be updated from storage
    this.initialized = false;
    this.folderLinks = []; // Store folder links for traversal
    this.visitedPages = new Set(); // Track visited pages to avoid infinite loops
    this.maxFolderDepth = 3; // Prevent excessive recursion
  }

  /**
   * Initialize the scraper with the API URL from storage
   */
  async initialize() {
    try {
      const data = await new Promise((resolve) => {
        chrome.storage.local.get("apiUrl", resolve);
      });

      if (data.apiUrl) {
        this.API_URL = data.apiUrl;
      }

      this.initialized = true;
      console.log("MoodleScraper initialized with API URL:", this.API_URL);
      return true;
    } catch (error) {
      console.error("Error initializing MoodleScraper:", error);
      return false;
    }
  }

  /**
   * Check if current page is a Moodle course page
   * @returns {boolean} True if the page is a Moodle course page
   */
  isMoodleCoursePage() {
    // Check if URL matches Moodle course pattern
    const url = window.location.href;
    return (
      url.includes("mdx.mrooms.net") &&
      url.includes("/course/view.php") &&
      url.includes("id=")
    );
  }

  /**
   * Extract module code and name from the page
   * @returns {Object} Module code and name
   */
  extractModuleInfo() {
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

  /**
   * Extract all document links from the page
   * @returns {Array} Array of document objects with name and url
   */
  extractDocumentLinks() {
    const documents = [];

    // Pattern 1: Standard resource links with icons (expanded)
    // This includes resource view links, assignment links, etc.
    const resourceLinks = document.querySelectorAll(
      'a[href*=".pdf"], a[href*=".docx"], a[href*=".doc"], a[href*=".pptx"], a[href*=".ppt"],' +
        'a[href*="resource/view.php"], a[href*="mod/resource/view.php"],' +
        'a[href*="pluginfile.php"], a[href*="forcedownload=1"],' +
        'a[href*="mod/assign/view.php"], a[href*="mod/folder/view.php"]'
    );

    resourceLinks.forEach((link) => {
      // Check for PDF, Word, or PPT icons or text indicators
      const hasDocIcon = link.querySelector(
        'img[src*="pdf"], img[src*="document"], img[src*="powerpoint"], i.fa-file-pdf-o, i.fa-file-word-o, i.fa-file-powerpoint-o'
      );

      // Check for text indicators like "DOCX" or "PDF" nearby
      const linkText = link.textContent.trim();
      const hasDocIndicator =
        /\b(pdf|docx|doc|pptx|ppt|word|powerpoint|document|handbook|lecture|assignment|submission)\b/i.test(
          linkText
        );

      const url = link.href;

      // Validate if it's a document link with expanded criteria
      if (this._isDocumentUrl(url) || hasDocIcon || hasDocIndicator) {
        const name = this._getFilenameFromLink(link, url);
        if (name) {
          // Don't add folder links to documents yet - they'll be processed separately
          if (!url.includes("mod/folder/view.php")) {
            documents.push({ name, url });
          }
        }
      }

      // Detect folder links for later traversal
      if (url.includes("mod/folder/view.php")) {
        this.folderLinks.push({ url, name: linkText });
      }
    });

    // Pattern 2: Activity resources (expanded)
    const activities = document.querySelectorAll(
      ".activity, .activityinstance, .modtype_resource, .modtype_assign, .modtype_folder"
    );
    activities.forEach((activity) => {
      const links = activity.querySelectorAll("a");
      links.forEach((link) => {
        const url = link.href;
        const linkText = link.textContent.trim();

        if (
          this._isDocumentUrl(url) ||
          /\b(pdf|docx|doc|pptx|ppt|handbook|lecture|notes)\b/i.test(linkText)
        ) {
          const name = this._getFilenameFromLink(link, url);
          if (name) {
            // Skip folder links for now
            if (!url.includes("mod/folder/view.php")) {
              documents.push({ name, url });
            }
          }
        }

        // Add folder links
        if (url.includes("mod/folder/view.php")) {
          this.folderLinks.push({ url, name: linkText });
        }
      });
    });

    // Pattern A: Look inside General section (common location for handbooks)
    const generalSections = document.querySelectorAll(
      ".section.main#section-0, .section.main[data-sectionid='0'], .content:has(>.sectionname:contains('General'))"
    );
    generalSections.forEach((section) => {
      const sectionLinks = section.querySelectorAll("a");
      sectionLinks.forEach((link) => {
        const url = link.href;
        const linkText = link.textContent.trim();

        // Look specifically for handbook-like content
        if (
          linkText.toLowerCase().includes("handbook") ||
          linkText.toLowerCase().includes("guide") ||
          linkText.toLowerCase().includes("syllabus") ||
          url.includes("resource/view.php") ||
          url.includes("mod/resource/view.php")
        ) {
          const name = this._getFilenameFromLink(link, url);
          if (name) {
            documents.push({ name, url });
          }
        }
      });
    });

    // Pattern B: Find links with force download parameter
    const forceDownloadLinks = document.querySelectorAll(
      'a[href*="forcedownload=1"]'
    );
    forceDownloadLinks.forEach((link) => {
      const url = link.href;
      const name = this._getFilenameFromLink(link, url);
      if (name) {
        documents.push({ name, url });
      }
    });

    // Pattern C: Find embedded iframes that might point to documents
    const iframes = document.querySelectorAll(
      'iframe[src*="pluginfile.php"], iframe[src*="resource/view.php"]'
    );
    iframes.forEach((iframe) => {
      const url = iframe.src;
      // Generate a name based on iframe attributes or parent content
      let name = iframe.title || iframe.alt || "";
      if (!name && iframe.parentElement) {
        // Try to get a name from nearby headings or labels
        const heading = iframe.parentElement.querySelector(
          "h3, h4, .instancename"
        );
        if (heading) {
          name = heading.textContent.trim();
        } else {
          name = iframe.parentElement.textContent.trim().substring(0, 30);
        }
      }

      // If we have a valid name and URL, add as document
      if (name && url && this._isDocumentUrl(url)) {
        const fileName = this._getFilenameFromLink({ textContent: name }, url);
        if (fileName) {
          documents.push({ name: fileName, url });
        }
      }
    });

    // Filter out duplicates by URL
    const uniqueDocuments = [];
    const seenUrls = new Set();

    documents.forEach((doc) => {
      if (!seenUrls.has(doc.url)) {
        seenUrls.add(doc.url);
        uniqueDocuments.push(doc);
      }
    });

    return uniqueDocuments;
  }

  /**
   * Check if a URL likely points to a document
   * @param {string} url The URL to check
   * @returns {boolean} True if it's a document URL
   */
  _isDocumentUrl(url) {
    if (!url) return false;

    // Direct file extensions
    if (/\.(pdf|docx?|pptx?|xlsx?)($|\?)/i.test(url)) {
      return true;
    }

    // Moodle resource links (expanded)
    if (/\/(resource|mod\/resource)\/view\.php/i.test(url)) {
      return true;
    }

    // Moodle pluginfile links (often used for files)
    if (/pluginfile\.php/i.test(url)) {
      return true;
    }

    // Assignment view links that might have attachments
    if (/mod\/assign\/view\.php/i.test(url)) {
      return true;
    }

    // Force download parameter
    if (url.includes("forcedownload=1")) {
      return true;
    }

    // Other common download patterns
    if (url.includes("download=1") || url.includes("filedown.php")) {
      return true;
    }

    return false;
  }

  /**
   * Extract a filename from a link
   * @param {Element} link The link element
   * @param {string} url The URL
   * @returns {string} The filename or null if not found
   */
  _getFilenameFromLink(link, url) {
    try {
      // First try to get filename from URL
      let filename = "";

      // Extract from direct URL if possible
      if (url.includes("pluginfile.php")) {
        // For pluginfile URLs, the filename is usually after the last slash and before any query parameters
        const urlPath = url.split("?")[0]; // Remove query parameters
        const pathParts = urlPath.split("/");
        if (pathParts.length > 0) {
          filename = pathParts[pathParts.length - 1];
        }
      } else if (url.includes("forcedownload=1")) {
        // Similar approach for force download URLs
        const urlPath = url.split("?")[0];
        const pathParts = urlPath.split("/");
        if (pathParts.length > 0) {
          filename = pathParts[pathParts.length - 1];
        }
      } else {
        // Standard approach for other URLs
        filename = url.split("/").pop().split("?")[0];
      }

      // If still no filename or it's too short, try to build from link text and context
      if (!filename || filename.length < 3) {
        const linkText = link.textContent.trim();

        // For resource view links, use the link text
        if (
          url.includes("resource/view.php") ||
          url.includes("mod/resource/view.php")
        ) {
          filename = linkText.replace(/[^\w\-. ]/g, "_");

          // Add appropriate extension based on context
          if (/handbook|guide|syllabus/i.test(linkText)) {
            filename += ".docx";
          } else if (/lecture|slides|presentation/i.test(linkText)) {
            filename += ".pptx";
          } else if (/assignment|submission/i.test(linkText)) {
            filename += ".pdf";
          } else {
            filename += ".pdf"; // Default to PDF
          }
        }
      }

      // If no extension, try to add one based on content
      if (filename && !filename.match(/\.(pdf|docx?|pptx?)$/i)) {
        const linkText = link.textContent.trim().toLowerCase();
        const imgSrc = link.querySelector("img")?.src || "";

        // Determine appropriate extension
        if (
          url.toLowerCase().includes("pdf") ||
          imgSrc.includes("pdf") ||
          linkText.includes("pdf")
        ) {
          filename += ".pdf";
        } else if (
          url.toLowerCase().includes("ppt") ||
          imgSrc.includes("powerpoint") ||
          linkText.includes("ppt") ||
          linkText.includes("slides") ||
          linkText.includes("presentation")
        ) {
          filename += ".pptx";
        } else if (
          url.toLowerCase().includes("doc") ||
          imgSrc.includes("document") ||
          linkText.includes("doc") ||
          linkText.includes("word") ||
          linkText.includes("handbook") ||
          linkText.includes("guide")
        ) {
          filename += ".docx";
        } else {
          // Try to infer from URL pattern
          if (url.includes("pluginfile.php")) {
            // Check if there's a file extension hint in the URL
            if (url.includes(".pdf")) {
              filename += ".pdf";
            } else if (url.includes(".ppt")) {
              filename += ".pptx";
            } else if (url.includes(".doc")) {
              filename += ".docx";
            } else {
              filename += ".pdf"; // Default to PDF
            }
          } else {
            filename += ".pdf"; // Default to PDF for unknown
          }
        }
      }

      // Clean up filename - remove invalid characters
      filename = filename.replace(/[^\w\-. ]/g, "_");

      // Make sure filename is valid and not too long
      if (!filename || filename.length < 3) {
        // Generate a generic name based on link text or URL
        const linkText = link.textContent.trim();
        if (linkText) {
          const safeName = linkText.replace(/[^\w\-. ]/g, "_").substring(0, 30);
          filename = `${safeName}_${Date.now()}.pdf`;
        } else {
          // Last resort: use timestamp with hint from URL
          const urlHint = url.includes("resource")
            ? "resource"
            : url.includes("assign")
            ? "assignment"
            : url.includes("pluginfile")
            ? "file"
            : "document";
          filename = `${urlHint}_${Date.now()}.pdf`;
        }
      }

      return filename;
    } catch (error) {
      console.error("Error generating filename:", error);
      return `document_${Date.now()}.pdf`; // Fallback for error cases
    }
  }

  /**
   * Extract text content from the page
   * @returns {string} The extracted content
   */
  extractPageContent() {
    let content = [];

    // Add page title
    content.push(`# ${document.title}\n`);

    // Extract module information
    const { moduleCode, moduleName } = this.extractModuleInfo();
    content.push(`Module: ${moduleCode} - ${moduleName}\n`);

    // Extract main course content
    const courseContent = document.querySelector(".course-content");
    if (courseContent) {
      // Process each section
      const sections = courseContent.querySelectorAll("li.section");
      sections.forEach((section) => {
        // Section name
        const sectionName = section.querySelector(".sectionname");
        if (sectionName) {
          content.push(`\n## ${sectionName.textContent.trim()}\n`);
        }

        // Process activities in this section
        const activities = section.querySelectorAll(".activity");
        activities.forEach((activity) => {
          const activityName = activity.querySelector(".instancename");
          if (activityName) {
            content.push(`\n### ${activityName.textContent.trim()}\n`);
          }

          // Activity description
          const description = activity.querySelector(".contentafterlink");
          if (description && description.textContent.trim()) {
            content.push(description.textContent.trim());
          }
        });
      });
    } else {
      // Fallback: extract any page content
      const mainContent = document.querySelector("#region-main");
      if (mainContent) {
        content.push(mainContent.textContent.trim());
      }
    }

    return content.join("\n");
  }

  /**
   * Get cookies from the current page
   * @returns {Object} The cookies as key-value pairs
   */
  getCookies() {
    const cookies = {};
    document.cookie.split(";").forEach((cookie) => {
      const parts = cookie.trim().split("=");
      if (parts.length === 2) {
        cookies[parts[0]] = parts[1];
      }
    });
    return cookies;
  }

  /**
   * Start the scraping process for the current page with folder traversal
   * @returns {Promise<Object>} Result of the scraping operation
   */
  async startScraping() {
    if (!this.initialized) {
      await this.initialize();
    }

    // Make sure this is a Moodle course page
    if (!this.isMoodleCoursePage()) {
      throw new Error("This is not a Moodle course page");
    }

    // Reset visited pages and folder links
    this.visitedPages = new Set();
    this.folderLinks = [];

    // Extract module information
    const { moduleCode, moduleName } = this.extractModuleInfo();

    // Get the current page URL
    const url = window.location.href;
    this.visitedPages.add(url);

    // Get the cookies for authentication
    const cookies = this.getCookies();

    // First extract all files from the current page
    const documents = this.extractDocumentLinks();
    console.log(`Found ${documents.length} documents on main page`);
    console.log(
      `Found ${this.folderLinks.length} folders to potentially traverse`
    );

    // Start scraping with the main page documents
    try {
      const response = await fetch(`${this.API_URL}/scraper/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          module_code: moduleCode,
          module_name: moduleName,
          cookies,
          documents: documents, // Include extracted documents
          has_folders: this.folderLinks.length > 0,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status}: ${response.statusText}`
        );
      }

      const result = await response.json();
      const taskId = result.task_id;

      // Process folders if found
      if (this.folderLinks.length > 0) {
        console.log(
          `Beginning to process ${this.folderLinks.length} folders...`
        );

        // Process each folder (up to a reasonable limit)
        const folderLimit = Math.min(this.folderLinks.length, 20); // Limit to 20 folders
        for (let i = 0; i < folderLimit; i++) {
          try {
            const folder = this.folderLinks[i];
            console.log(
              `Processing folder (${i + 1}/${folderLimit}): ${folder.name}`
            );

            // Create a hidden iframe to load the folder content
            const folderFiles = await this._extractFilesFromFolder(folder.url);

            if (folderFiles.length > 0) {
              console.log(
                `Found ${folderFiles.length} files in folder "${folder.name}"`
              );

              // Send these files to the server
              await fetch(`${this.API_URL}/scraper/add_folder_documents`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  task_id: taskId,
                  module_code: moduleCode,
                  folder_url: folder.url,
                  documents: folderFiles,
                }),
              });
            }
          } catch (error) {
            console.error(
              `Error processing folder ${this.folderLinks[i].name}:`,
              error
            );
          }
        }

        // Signal that folder processing is complete
        await fetch(`${this.API_URL}/scraper/complete_folders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            task_id: taskId,
          }),
        });
      }

      console.log("Scraping task completed:", result);

      return {
        success: true,
        taskId: result.task_id,
        moduleCode,
        moduleName,
      };
    } catch (error) {
      console.error("Error in scraping process:", error);
      return {
        success: false,
        error: error.message,
        moduleCode,
        moduleName,
      };
    }
  }

  /**
   * Extract files from a folder using an iframe
   * @param {string} folderUrl - The URL of the folder to process
   * @returns {Promise<Array>} - Array of document objects with name and url
   */
  async _extractFilesFromFolder(folderUrl) {
    return new Promise((resolve, reject) => {
      // Create a hidden iframe
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      document.body.appendChild(iframe);

      // Set timeout to prevent hanging
      const timeout = setTimeout(() => {
        document.body.removeChild(iframe);
        reject(new Error("Folder loading timed out"));
      }, 30000);

      // Handle iframe load
      iframe.onload = () => {
        try {
          const iframeDoc =
            iframe.contentDocument || iframe.contentWindow.document;

          // Check if we got valid content
          if (!iframeDoc || !iframeDoc.body) {
            clearTimeout(timeout);
            document.body.removeChild(iframe);
            resolve([]);
            return;
          }

          // Extract links from the folder page
          const folderFiles = [];

          // Look for file links - folder pages often have a specific structure
          const fileLinks = iframeDoc.querySelectorAll(
            'a[href*="pluginfile.php"], ' +
              'a[href*=".pdf"], a[href*=".docx"], a[href*=".doc"], a[href*=".pptx"], a[href*=".ppt"], ' +
              'a[href*="forcedownload=1"]'
          );

          fileLinks.forEach((link) => {
            const url = link.href;
            const linkText = link.textContent.trim();

            // Check if it looks like a document link
            if (this._isFileLink(url, linkText)) {
              // Generate a filename
              let filename;

              // Try to get filename from the URL first
              if (url.includes("/")) {
                const urlParts = url.split("/");
                const lastPart = urlParts[urlParts.length - 1].split("?")[0];
                if (lastPart && lastPart.length > 3) {
                  filename = lastPart;
                }
              }

              // If no filename from URL, use link text
              if (!filename && linkText) {
                filename = linkText.replace(/[^\w\-. ]/g, "_");

                // Add appropriate extension based on context
                if (
                  url.includes(".pdf") ||
                  linkText.toLowerCase().includes("pdf")
                ) {
                  if (!filename.toLowerCase().endsWith(".pdf"))
                    filename += ".pdf";
                } else if (
                  url.includes(".docx") ||
                  url.includes(".doc") ||
                  linkText.toLowerCase().includes("doc") ||
                  linkText.toLowerCase().includes("word")
                ) {
                  if (
                    !filename.toLowerCase().endsWith(".docx") &&
                    !filename.toLowerCase().endsWith(".doc")
                  )
                    filename += ".docx";
                } else if (
                  url.includes(".pptx") ||
                  url.includes(".ppt") ||
                  linkText.toLowerCase().includes("ppt") ||
                  linkText.toLowerCase().includes("presentation") ||
                  linkText.toLowerCase().includes("slides")
                ) {
                  if (
                    !filename.toLowerCase().endsWith(".pptx") &&
                    !filename.toLowerCase().endsWith(".ppt")
                  )
                    filename += ".pptx";
                } else {
                  // Default
                  filename += ".pdf";
                }
              }

              // If still no valid filename, generate one
              if (!filename || filename.length < 3) {
                filename = `file_${Date.now()}_${Math.floor(
                  Math.random() * 1000
                )}.pdf`;
              }

              folderFiles.push({
                name: filename,
                url: url,
              });
            }
          });

          // Clean up
          clearTimeout(timeout);
          document.body.removeChild(iframe);
          resolve(folderFiles);
        } catch (error) {
          clearTimeout(timeout);
          document.body.removeChild(iframe);
          reject(error);
        }
      };

      // Set iframe source
      iframe.src = folderUrl;
    });
  }

  /**
   * Helper method to determine if a URL is likely a file link
   * @param {string} url - The URL to check
   * @param {string} linkText - Text of the link
   * @returns {boolean} - True if this appears to be a file link
   */
  _isFileLink(url, linkText) {
    if (!url) return false;

    // Check common file extensions
    if (/\.(pdf|docx?|pptx?|xlsx?)($|\?)/i.test(url)) {
      return true;
    }

    // Check for Moodle file URLs
    if (url.includes("pluginfile.php") || url.includes("forcedownload=1")) {
      return true;
    }

    // Check link text for file type indicators
    if (
      linkText &&
      /\b(pdf|docx?|pptx?|word|powerpoint|excel|document|file)\b/i.test(
        linkText
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * Check the status of a scraping task
   * @param {string} taskId The task ID
   * @returns {Promise<Object>} The task status
   */
  async checkScrapingStatus(taskId) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const response = await fetch(`${this.API_URL}/scraper/status/${taskId}`);

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status}: ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Error checking scraping status:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Make the scraper available globally
window.MoodleScraper = new MoodleScraper();
