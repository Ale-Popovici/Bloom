// BLOOM - Azure Configuration File
// Place this file in the conversation folder: bloom-extension/extension/conversation/azure-config.js

// Azure Speech Service Configuration
export const AzureConfig = {
  // IMPORTANT: Replace these with your actual Azure Speech Service credentials
  speechKey:
    "9Q21R5YBfRu524MsB71bNcRg0u8P6YM9HM1AR8QsixXFzNytln9UJQQJ99BCACmepeSXJ3w3AAAYACOGzIoR", // Replace with your key
  speechRegion: "uksouth", // Replace with your region

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

// Don't modify below this line
export async function getSpeechToken() {
  // In a production environment, this should call your backend to securely get a token
  // For simplicity in this extension, we'll use the key directly
  return {
    authToken: AzureConfig.speechKey,
    region: AzureConfig.speechRegion,
  };
}
