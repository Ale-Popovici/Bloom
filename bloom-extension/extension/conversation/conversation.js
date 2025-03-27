// BLOOM - Conversation Mode

import { SpeechService } from "./speech-service.js";
import { Avatar } from "./avatar.js";
import { AzureConfig } from "./azure-config.js";

export class ConversationManager {
  constructor(container) {
    this.container = container;
    this.speechService = null;
    this.avatar = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.captionsEnabled = AzureConfig.options.enableCaptions;
    this.initialized = false;
    this.messageHandler = null;

    // DOM elements (will be created during initialization)
    this.avatarContainer = null;
    this.statusText = null;
    this.captionsContainer = null;
    this.micButton = null;
    this.captionToggle = null;
    this.backButton = null;
  }

  /**
   * Initialize conversation mode with UI and services
   * @param {Object} messageHandler - Handlers for sending/receiving messages
   */
  async initialize(messageHandler) {
    // Store message handler
    this.messageHandler = messageHandler;

    try {
      // Create UI
      this.createUI();

      // Initialize speech service
      this.speechService = new SpeechService();

      // Set up speech service callbacks
      this.speechService.onRecognized = (text) =>
        this.handleRecognizedSpeech(text);
      this.speechService.onRecognizing = (text) =>
        this.updateCaptions(text, true);
      this.speechService.onSynthesisStarted = () => this.handleSpeechStart();
      this.speechService.onSynthesisCompleted = () => this.handleSpeechEnd();
      this.speechService.onVisemeReceived = (visemeId) =>
        this.avatar.handleViseme(visemeId);
      this.speechService.onError = (error) => this.handleError(error);

      await this.speechService.initialize();

      // Initialize avatar
      this.avatar = new Avatar(this.avatarContainer);
      this.avatar.initialize();

      // Add event listeners
      this.micButton.addEventListener("click", () => this.toggleListening());
      this.captionToggle.addEventListener("click", () => this.toggleCaptions());
      this.backButton.addEventListener("click", () => {
        if (this.messageHandler.onSwitchMode) {
          this.messageHandler.onSwitchMode("text");
        }
      });

      // Update status
      this.updateStatus(
        "Ready to chat. Click the microphone to start talking."
      );

      this.initialized = true;
      return true;
    } catch (error) {
      console.error("Error initializing conversation manager:", error);
      this.handleError(`Failed to initialize: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create the conversation UI elements
   */
  createUI() {
    // Clear container
    this.container.innerHTML = "";

    // Add CSS if not already added
    if (!document.getElementById("bloom-conversation-styles")) {
      const linkElement = document.createElement("link");
      linkElement.id = "bloom-conversation-styles";
      linkElement.rel = "stylesheet";
      linkElement.href = chrome.runtime.getURL("conversation/conversation.css");
      document.head.appendChild(linkElement);
    }

    // Create avatar container
    this.avatarContainer = document.createElement("div");
    this.avatarContainer.className = "bloom-avatar-container";
    this.container.appendChild(this.avatarContainer);

    // Create controls
    const controlsContainer = document.createElement("div");
    controlsContainer.className = "bloom-conversation-controls";

    // Microphone button
    this.micButton = document.createElement("button");
    this.micButton.className = "bloom-mic-button";
    this.micButton.title = "Click to talk";
    this.micButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 1C11.2044 1 10.4413 1.31607 9.87868 1.87868C9.31607 2.44129 9 3.20435 9 4V12C9 12.7956 9.31607 13.5587 9.87868 14.1213C10.4413 14.6839 11.2044 15 12 15C12.7956 15 13.5587 14.6839 14.1213 14.1213C14.6839 13.5587 15 12.7956 15 12V4C15 3.20435 14.6839 2.44129 14.1213 1.87868C13.5587 1.31607 12.7956 1 12 1Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M19 10V12C19 13.8565 18.2625 15.637 16.9497 16.9497C15.637 18.2625 13.8565 19 12 19C10.1435 19 8.36301 18.2625 7.05025 16.9497C5.7375 15.637 5 13.8565 5 12V10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 19V23" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 23H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    controlsContainer.appendChild(this.micButton);

    // Caption toggle
    this.captionToggle = document.createElement("button");
    this.captionToggle.className = "bloom-caption-toggle";
    // Set initial state based on default
    if (this.captionsEnabled) {
      this.captionToggle.classList.add("bloom-active");
    }
    this.captionToggle.title = "Toggle captions";
    this.captionToggle.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 7H22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 11H22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M11 15H22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M11 19H22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    controlsContainer.appendChild(this.captionToggle);

    // Back button
    this.backButton = document.createElement("button");
    this.backButton.className = "bloom-back-button";
    this.backButton.title = "Back to text chat";
    this.backButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 12H5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 19L5 12L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    controlsContainer.appendChild(this.backButton);

    this.container.appendChild(controlsContainer);

    // Status text
    this.statusText = document.createElement("div");
    this.statusText.className = "bloom-status-text";
    this.statusText.textContent = "Initializing...";
    this.container.appendChild(this.statusText);

    // Captions container
    this.captionsContainer = document.createElement("div");
    this.captionsContainer.className = "bloom-captions-container";
    if (!this.captionsEnabled) {
      this.captionsContainer.style.display = "none";
    }
    this.container.appendChild(this.captionsContainer);
  }

  /**
   * Toggle listening state (start/stop microphone)
   */
  async toggleListening() {
    if (!this.initialized) {
      return;
    }

    try {
      if (this.isListening) {
        await this.stopListening();
      } else {
        await this.startListening();
      }
    } catch (error) {
      console.error("Error toggling listening:", error);
      this.handleError(`Microphone error: ${error.message}`);
    }
  }

  /**
   * Start listening for speech
   */
  async startListening() {
    if (this.isListening || this.isSpeaking) {
      return;
    }

    try {
      // Start speech recognition
      await this.speechService.startRecognition();
      this.isListening = true;

      // Update UI
      this.micButton.classList.add("bloom-active");
      this.updateStatus("Listening...");

      // Set avatar to thinking expression
      this.avatar.setExpression("thinking");

      return true;
    } catch (error) {
      console.error("Error starting listening:", error);
      this.handleError(`Could not access microphone. ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop listening for speech
   */
  async stopListening() {
    if (!this.isListening) {
      return;
    }

    try {
      // Stop speech recognition
      await this.speechService.stopRecognition();
      this.isListening = false;

      // Update UI
      this.micButton.classList.remove("bloom-active");
      this.updateStatus("Click the microphone to start talking.");

      // Set avatar back to neutral
      this.avatar.setExpression("neutral");

      return true;
    } catch (error) {
      console.error("Error stopping listening:", error);
      throw error;
    }
  }

  /**
   * Toggle captions visibility
   */
  toggleCaptions() {
    this.captionsEnabled = !this.captionsEnabled;

    // Update UI
    if (this.captionsEnabled) {
      this.captionToggle.classList.add("bloom-active");
      this.captionsContainer.style.display = "block";
    } else {
      this.captionToggle.classList.remove("bloom-active");
      this.captionsContainer.style.display = "none";
    }
  }

  /**
   * Update the status text
   * @param {string} text - Status text
   */
  updateStatus(text) {
    if (this.statusText) {
      this.statusText.textContent = text;
    }
  }

  /**
   * Update captions display
   * @param {string} text - Caption text
   * @param {boolean} isInterim - Whether it's an interim result
   */
  updateCaptions(text, isInterim = false) {
    if (!this.captionsEnabled || !this.captionsContainer) {
      return;
    }

    if (isInterim) {
      // Interim results in italics
      this.captionsContainer.innerHTML = `<p class="bloom-interim">${text}</p>`;
    } else {
      // Final result
      this.captionsContainer.innerHTML = `<p>${text}</p>`;
    }

    // Scroll to bottom
    this.captionsContainer.scrollTop = this.captionsContainer.scrollHeight;
  }

  /**
   * Handle speech recognition results
   * @param {string} text - Recognized text
   */
  async handleRecognizedSpeech(text) {
    if (!text || !text.trim()) {
      return;
    }

    try {
      // Stop listening while processing
      await this.stopListening();

      // Update status
      this.updateStatus("Processing...");

      // Update captions with final recognition
      this.updateCaptions(text, false);

      // Send to message handler to get response
      if (this.messageHandler && this.messageHandler.onUserMessage) {
        await this.messageHandler.onUserMessage(text);
      }
    } catch (error) {
      console.error("Error handling recognized speech:", error);
      this.handleError(`Error processing your request. ${error.message}`);
    }
  }

  /**
   * Speak a response through the avatar
   * @param {string} text - Text to speak
   */
  async speakResponse(text) {
    if (!text || !text.trim() || !this.initialized) {
      return;
    }

    try {
      // Update status
      this.updateStatus("Speaking...");

      // Speak the text
      await this.speechService.synthesizeSpeech(text);

      // Update status when done
      this.updateStatus("Click the microphone to start talking.");

      // If configured to continue listening, start again
      if (AzureConfig.options.continueListening) {
        setTimeout(() => this.startListening(), 500);
      }

      return true;
    } catch (error) {
      console.error("Error speaking response:", error);
      this.handleError(`Speech synthesis error: ${error.message}`);
      return false;
    }
  }

  /**
   * Handle speech synthesis start
   */
  handleSpeechStart() {
    this.isSpeaking = true;

    // Update avatar to speaking state
    this.avatar.setSpeaking(true);
  }

  /**
   * Handle speech synthesis end
   */
  handleSpeechEnd() {
    this.isSpeaking = false;

    // Update avatar to non-speaking state
    this.avatar.setSpeaking(false);
  }

  /**
   * Handle errors
   * @param {string} message - Error message
   */
  handleError(message) {
    console.error("Conversation error:", message);

    // Update status with error
    if (this.statusText) {
      this.statusText.innerHTML = `<span style="color: var(--mdx-red);">Error: ${message}</span>`;
    }

    // Set confused expression on avatar
    if (this.avatar) {
      this.avatar.setExpression("confused");
    }

    // Reset speaking/listening state
    this.isSpeaking = false;
    this.isListening = false;
    if (this.micButton) {
      this.micButton.classList.remove("bloom-active");
    }
  }

  /**
   * Clean up resources when closing conversation mode
   */
  dispose() {
    // Stop speech recognition
    if (this.speechService) {
      if (this.isListening) {
        this.speechService.stopRecognition();
      }
      if (this.isSpeaking) {
        this.speechService.stopSpeaking();
      }
      this.speechService.dispose();
    }

    // Remove event listeners if needed
    if (this.micButton) {
      this.micButton.removeEventListener("click", this.toggleListening);
    }
    if (this.captionToggle) {
      this.captionToggle.removeEventListener("click", this.toggleCaptions);
    }
    if (this.backButton) {
      this.backButton.removeEventListener("click", () => {
        if (this.messageHandler.onSwitchMode) {
          this.messageHandler.onSwitchMode("text");
        }
      });
    }

    // Clear container
    if (this.container) {
      this.container.innerHTML = "";
    }

    // Reset states
    this.isListening = false;
    this.isSpeaking = false;
    this.initialized = false;
  }
}
