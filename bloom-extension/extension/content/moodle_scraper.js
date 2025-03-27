// BLOOM - Moodle Scraper Module
// Handles the extraction of documents and content from Moodle pages

class MoodleScraper {
  constructor() {
    this.API_URL = "http://localhost:8000"; // This will be updated from storage
    this.initialized = false;
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

    // Pattern 1: Standard resource links with icons
    const resourceLinks = document.querySelectorAll(
      'a[href*=".pdf"], a[href*=".docx"], a[href*="resource/view.php"]'
    );
    resourceLinks.forEach((link) => {
      // Check for PDF or Word icons
      const hasDocIcon = link.querySelector(
        'img[src*="pdf"], img[src*="document"], i.fa-file-pdf-o, i.fa-file-word-o'
      );
      const url = link.href;

      // Validate if it's a document link
      if (this._isDocumentUrl(url) || hasDocIcon) {
        const name = this._getFilenameFromLink(link, url);
        if (name) {
          documents.push({ name, url });
        }
      }
    });

    // Pattern 2: Activity resources
    const activities = document.querySelectorAll(".activity");
    activities.forEach((activity) => {
      const links = activity.querySelectorAll("a");
      links.forEach((link) => {
        const url = link.href;
        if (this._isDocumentUrl(url)) {
          const name = this._getFilenameFromLink(link, url);
          if (name) {
            documents.push({ name, url });
          }
        }
      });
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
    // Direct PDF/DOCX links
    if (/\.(pdf|docx)($|\?)/i.test(url)) {
      return true;
    }

    // Moodle resource links
    if (/resource\/view\.php/i.test(url)) {
      return true;
    }

    // Moodle pluginfile links (often used for files)
    if (/pluginfile\.php/i.test(url)) {
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
    // Try to get filename from URL
    let filename = url.split("/").pop().split("?")[0];

    // If no extension, try to add one based on content
    if (!filename.match(/\.(pdf|docx)$/i)) {
      const linkText = link.textContent.trim();
      const imgSrc = link.querySelector("img")?.src || "";

      if (
        url.toLowerCase().includes("pdf") ||
        imgSrc.includes("pdf") ||
        /pdf/i.test(linkText)
      ) {
        filename += ".pdf";
      } else if (
        url.toLowerCase().includes("doc") ||
        imgSrc.includes("document") ||
        /doc/i.test(linkText)
      ) {
        filename += ".docx";
      } else {
        // Default to PDF if we can't determine
        filename += ".pdf";
      }
    }

    // Clean up filename - remove invalid characters
    filename = filename.replace(/[^\w\-. ]/g, "_");

    // Make sure filename is valid
    if (!filename || !filename.match(/\.(pdf|docx)$/i)) {
      // Generate a generic name based on link text
      const linkText = link.textContent.trim().replace(/[^\w\-. ]/g, "_");
      if (linkText) {
        filename = `${linkText}.pdf`;
      } else {
        // Last resort
        filename = `document_${Date.now()}.pdf`;
      }
    }

    return filename;
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
   * Start the scraping process for the current page
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

    // Extract module information
    const { moduleCode, moduleName } = this.extractModuleInfo();

    // Get the current page URL
    const url = window.location.href;

    // Get the cookies for authentication
    const cookies = this.getCookies();

    // Send request to start scraping
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
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status}: ${response.statusText}`
        );
      }

      const result = await response.json();
      console.log("Scraping started:", result);

      return {
        success: true,
        taskId: result.task_id,
        moduleCode,
        moduleName,
      };
    } catch (error) {
      console.error("Error starting scraping:", error);
      return {
        success: false,
        error: error.message,
        moduleCode,
        moduleName,
      };
    }
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
