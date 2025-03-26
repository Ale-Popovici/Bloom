document.addEventListener("DOMContentLoaded", function () {
  const uploadBtn = document.getElementById("upload-btn");
  const fileInput = document.getElementById("file-input");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const chatMessages = document.getElementById("chat-messages");
  const statusDiv = document.getElementById("status");

  const API_URL = "http://localhost:8000";

  uploadBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    statusDiv.textContent = `Uploading ${file.name}...`;

    try {
      const response = await fetch(`${API_URL}/documents/upload`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        statusDiv.textContent = `${file.name} uploaded and processed successfully!`;
        addBotMessage(
          "I've processed your document. What would you like to know about it?"
        );
      } else {
        statusDiv.textContent = `Error: ${
          result.detail || "Failed to upload document"
        }`;
      }
    } catch (error) {
      statusDiv.textContent = `Error: ${error.message}`;
    }
  });

  sendBtn.addEventListener("click", sendMessage);
  userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  function addUserMessage(text) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "message user-message";
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addBotMessage(text) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "message bot-message";
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    addUserMessage(message);
    userInput.value = "";
    statusDiv.textContent = "BLOOM is thinking...";

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: message }),
      });

      const result = await response.json();

      if (response.ok) {
        addBotMessage(result.response);
        statusDiv.textContent = "";
      } else {
        statusDiv.textContent = `Error: ${
          result.detail || "Failed to get response"
        }`;
      }
    } catch (error) {
      statusDiv.textContent = `Error: ${error.message}`;
    }
  }

  // Add welcome message
  addBotMessage(
    "Hello! I'm BLOOM. Upload a PDF or Word document, and I'll help you find information in it."
  );
});
