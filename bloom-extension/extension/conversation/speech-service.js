// BLOOM - Speech Service

import { AzureConfig, getSpeechToken } from "./azure-config.js";

export class SpeechService {
  constructor() {
    this.speechRecognizer = null;
    this.speechSynthesizer = null;
    this.isRecording = false;
    this.isSpeaking = false;
    this.onRecognized = null;
    this.onRecognizing = null;
    this.onSynthesisStarted = null;
    this.onSynthesisCompleted = null;
    this.onVisemeReceived = null;
    this.onError = null;
    this.speechConfig = null;
    this.initialized = false;
    this.microphonePermissionGranted = false;
  }

  /**
   * Initialize Azure Speech SDK
   */
  async initialize() {
    // Check if SDK is loaded
    if (!window.SpeechSDK) {
      console.warn(
        "Microsoft Speech SDK not detected, attempting to load dynamically..."
      );
      try {
        await this.loadSpeechSDK();
      } catch (error) {
        throw new Error(
          "Failed to load Microsoft Speech SDK: " + error.message
        );
      }
    }

    try {
      // Validate Azure configuration
      if (
        !AzureConfig.speechKey ||
        AzureConfig.speechKey.includes("Replace with your key") ||
        AzureConfig.speechKey.length < 10
      ) {
        throw new Error(
          "Invalid Azure Speech API key. Please configure a valid key in azure-config.js"
        );
      }

      // Get speech token
      const { authToken, region } = await getSpeechToken();

      // Create speech config
      this.speechConfig = window.SpeechSDK.SpeechConfig.fromSubscription(
        authToken,
        region
      );

      // Configure speech recognition
      this.speechConfig.speechRecognitionLanguage = "en-US";
      this.speechConfig.enableDictation();

      // Configure speech synthesis
      this.speechConfig.speechSynthesisVoiceName = AzureConfig.voice.name;

      this.initialized = true;
      return true;
    } catch (error) {
      console.error("Failed to initialize speech service:", error);
      if (this.onError)
        this.onError("Failed to initialize speech services: " + error.message);
      throw error;
    }
  }

  /**
   * Load the Microsoft Speech SDK dynamically
   */
  loadSpeechSDK() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@latest/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js";
      script.onload = () => {
        console.log("Microsoft Speech SDK loaded successfully");
        resolve();
      };
      script.onerror = () =>
        reject(new Error("Failed to load Microsoft Speech SDK"));
      document.head.appendChild(script);
    });
  }

  /**
   * Request microphone permission
   */
  async requestMicrophonePermission() {
    try {
      // This will trigger the browser permission dialog
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // If we get here, permission was granted - store the stream for cleanup
      this.microphoneStream = stream;
      this.microphonePermissionGranted = true;

      return true;
    } catch (error) {
      console.error("Microphone permission denied:", error);
      this.microphonePermissionGranted = false;

      if (error.name === "NotAllowedError") {
        throw new Error(
          "Microphone access was denied. Please allow microphone access to use voice features."
        );
      } else if (error.name === "NotFoundError") {
        throw new Error(
          "No microphone detected. Please connect a microphone and try again."
        );
      } else {
        throw new Error("Microphone error: " + error.message);
      }
    }
  }

  /**
   * Start speech recognition
   */
  async startRecognition() {
    if (!this.initialized) {
      throw new Error("Speech service not initialized");
    }

    if (this.isRecording) {
      return; // Already recording
    }

    try {
      // Request microphone permission if not already granted
      if (!this.microphonePermissionGranted) {
        await this.requestMicrophonePermission();
      }

      // Create audio config for microphone
      const audioConfig =
        window.SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

      // Create speech recognizer
      this.speechRecognizer = new window.SpeechSDK.SpeechRecognizer(
        this.speechConfig,
        audioConfig
      );

      // Set up event handlers
      // Fired when recognition has finalized text
      this.speechRecognizer.recognized = (s, e) => {
        if (
          e.result.reason === window.SpeechSDK.ResultReason.RecognizedSpeech
        ) {
          const text = e.result.text;
          if (text.trim() && this.onRecognized) {
            this.onRecognized(text);
          }
        }
      };

      // Fired during recognition (interim results)
      this.speechRecognizer.recognizing = (s, e) => {
        if (
          e.result.reason === window.SpeechSDK.ResultReason.RecognizingSpeech
        ) {
          const text = e.result.text;
          if (this.onRecognizing) {
            this.onRecognizing(text);
          }
        }
      };

      // Handle errors
      this.speechRecognizer.canceled = (s, e) => {
        if (e.reason === window.SpeechSDK.CancellationReason.Error) {
          console.error(
            `Speech recognition error: ${e.errorCode} - ${e.errorDetails}`
          );
          if (this.onError)
            this.onError(`Speech recognition error: ${e.errorDetails}`);
        }
        this.isRecording = false;
      };

      // Start continuous recognition
      await this.speechRecognizer.startContinuousRecognitionAsync();
      this.isRecording = true;
      return true;
    } catch (error) {
      console.error("Failed to start speech recognition:", error);
      if (this.onError)
        this.onError("Failed to access microphone: " + error.message);
      throw error;
    }
  }

  /**
   * Stop speech recognition
   */
  async stopRecognition() {
    if (!this.speechRecognizer || !this.isRecording) {
      return;
    }

    try {
      await this.speechRecognizer.stopContinuousRecognitionAsync();
      this.isRecording = false;
      return true;
    } catch (error) {
      console.error("Failed to stop speech recognition:", error);
      throw error;
    }
  }

  /**
   * Synthesize speech from text
   * @param {string} text - Text to synthesize
   */
  async synthesizeSpeech(text) {
    if (!this.initialized) {
      throw new Error("Speech service not initialized");
    }

    if (this.isSpeaking) {
      // Cancel current speech
      await this.stopSpeaking();
    }

    try {
      // Create audio config for speaker output
      const audioConfig =
        window.SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();

      // Create speech synthesizer
      this.speechSynthesizer = new window.SpeechSDK.SpeechSynthesizer(
        this.speechConfig,
        audioConfig
      );

      // Clean text for speech (remove citations)
      const cleanText = this.removeCitations(text);

      // Create SSML for more expressive speech
      const ssml = this.generateSSML(cleanText);

      // Set up viseme (lip sync) events
      this.speechSynthesizer.visemeReceived = (s, e) => {
        if (this.onVisemeReceived) {
          this.onVisemeReceived(e.visemeId, e.audioOffset);
        }
      };

      // Set up other events
      this.speechSynthesizer.synthesisStarted = (s, e) => {
        this.isSpeaking = true;
        if (this.onSynthesisStarted) this.onSynthesisStarted();
      };

      this.speechSynthesizer.synthesisCompleted = (s, e) => {
        this.isSpeaking = false;
        if (this.onSynthesisCompleted) this.onSynthesisCompleted();
      };

      this.speechSynthesizer.synthesisCanceled = (s, e) => {
        this.isSpeaking = false;
        if (e.reason === window.SpeechSDK.CancellationReason.Error) {
          console.error(`Speech synthesis error: ${e.errorDetails}`);
          if (this.onError)
            this.onError(`Speech synthesis error: ${e.errorDetails}`);
        }
      };

      // Speak the SSML
      const result = await this.speechSynthesizer.speakSsmlAsync(ssml);

      if (
        result.reason ===
        window.SpeechSDK.ResultReason.SynthesizingAudioCompleted
      ) {
        return true;
      } else {
        console.error(`Speech synthesis failed: ${result.errorDetails}`);
        throw new Error(`Speech synthesis failed: ${result.errorDetails}`);
      }
    } catch (error) {
      console.error("Failed to synthesize speech:", error);
      if (this.onError) this.onError("Failed to speak: " + error.message);
      throw error;
    }
  }

  /**
   * Stop speech synthesis
   */
  async stopSpeaking() {
    if (!this.speechSynthesizer || !this.isSpeaking) {
      return;
    }

    try {
      await this.speechSynthesizer.close();
      this.isSpeaking = false;
      return true;
    } catch (error) {
      console.error("Failed to stop speech synthesis:", error);
      throw error;
    }
  }

  /**
   * Remove citations for cleaner speech output
   * @param {string} text - Text with citations
   * @returns {string} - Text without citations
   */
  removeCitations(text) {
    if (!AzureConfig.options.removeSourceCitations) {
      return text;
    }

    // Remove footnote-style citations [1], [2], etc.
    let cleanText = text.replace(/\[\d+\]/g, "");

    // Remove parenthetical citations containing file references
    cleanText = cleanText.replace(
      /\([^)]*(?:File\.pdf|\.docx|\.pdf|Chunk|Chunks)[^)]*\)/g,
      ""
    );

    return cleanText;
  }

  /**
   * Generate SSML for more expressive speech
   * @param {string} text - Plain text to convert to SSML
   * @returns {string} - SSML string
   */
  generateSSML(text) {
    return `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" 
             xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
        <voice name="${AzureConfig.voice.name}">
          <mstts:express-as style="${AzureConfig.voice.style}" styledegree="1">
            <prosody rate="${AzureConfig.voice.rate}" pitch="${AzureConfig.voice.pitch}%">
              ${text}
            </prosody>
          </mstts:express-as>
        </voice>
      </speak>
    `;
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.speechRecognizer) {
      this.speechRecognizer.close();
      this.speechRecognizer = null;
    }

    if (this.speechSynthesizer) {
      this.speechSynthesizer.close();
      this.speechSynthesizer = null;
    }

    // Release microphone stream if we have one
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach((track) => track.stop());
      this.microphoneStream = null;
    }

    this.isRecording = false;
    this.isSpeaking = false;
    this.microphonePermissionGranted = false;
  }
}
