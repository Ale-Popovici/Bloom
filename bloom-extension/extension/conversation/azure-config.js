// BLOOM - Azure Configuration File
// Place this file in the conversation folder: bloom-extension/extension/conversation/azure-config.js

// Azure Speech Service Configuration
export const AzureConfig = {
  // IMPORTANT: Replace these with your actual Azure Speech Service credentials
  speechKey:
    "9Q21R5YBfRu524MsB71bNcRg0u8P6YM9HM1AR8QsixXFzNytln9UJQQJ99BCACmepeSXJ3w3AAAYACOGzIoR",
  speechRegion: "uksouth",

  // Voice selection for speech synthesis
  voice: {
    name: "en-US-JennyNeural", // Neural voice for more natural speech
    style: "friendly", // Voice style: friendly, cheerful, excited, etc.
    rate: 1.1, // Speech rate (1.0 is normal, higher is faster)
    pitch: 0, // Voice pitch adjustment (0 is normal)
  },

  // Options for conversation mode
  options: {
    enableMicOnStart: false, // Don't start listening immediately
    continueListening: true, // Continue listening after each response
    enableCaptions: true, // Show captions by default
    removeSourceCitations: true, // Remove citations for speech output
    autoStartConversation: false, // Don't start conversation automatically
  },
};

// Function to get the speech token - can be expanded in future to call a backend
export async function getSpeechToken() {
  // Get from storage if possible
  try {
    const data = await new Promise((resolve) => {
      chrome.storage.local.get(
        ["azureSpeechKey", "azureSpeechRegion"],
        resolve
      );
    });

    // If we have values in storage, use those
    if (data.azureSpeechKey && data.azureSpeechRegion) {
      return {
        authToken: data.azureSpeechKey,
        region: data.azureSpeechRegion,
      };
    }
  } catch (error) {
    console.warn("Could not retrieve Azure credentials from storage", error);
  }

  // Fall back to the config values if not in storage
  if (!AzureConfig.speechKey) {
    throw new Error(
      "No Azure Speech key configured. Please set your Azure Speech key in settings."
    );
  }

  return {
    authToken: AzureConfig.speechKey,
    region: AzureConfig.speechRegion,
  };
}
