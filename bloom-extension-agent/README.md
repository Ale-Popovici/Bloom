# BLOOM - Middlesex University Document Assistant

BLOOM is a Chrome extension that allows Middlesex University students to chat with their course materials using AI. Upload PDFs and Word documents, scrape Moodle course pages, and ask questions about your course content.

## Features

- **Document Chat**: Ask questions about your course documents and get AI-powered responses
- **Moodle Integration**: Directly scrape course materials from Middlesex University Moodle pages
- **Multi-Document Support**: Upload PDFs and Word documents through the Chrome extension
- **Module Organization**: Keep documents organized by module code
- **Intelligent Responses**: Powered by OpenAI's GPT-4o language model
- **Vector Search**: Utilizes ChromaDB for semantic document search
- **Side Panel Interface**: Chat with your documents directly on any webpage

## Screenshots

(Add screenshots here)

## Architecture

The BLOOM extension consists of two main components:

1. **Chrome Extension**: Frontend interface with document upload, chat, and Moodle scraping capabilities
2. **Backend Service**: Python FastAPI server that processes documents, manages the vector database, and generates AI responses

## Prerequisites

- Python 3.8+ with pip
- Node.js and npm (for extension development)
- Chrome browser
- OpenAI API key

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/Ale-Popovici/bloom-extension.git
cd bloom-extension
```

### 2. Backend Setup

Create a virtual environment for the Python backend:

```bash
# Navigate to the backend directory
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows
venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file in the `backend` directory with your OpenAI API key:

```
OPENAI_API_KEY=your_openai_api_key_here
```

### 4. Create Database Directory

Create a directory for the ChromaDB database:

```bash
mkdir -p ../database/chroma_db
```

### 5. Start the Backend Server

Start the FastAPI backend server:

```bash
# Make sure you're in the backend directory
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

The backend server should now be running at `http://localhost:8000`

### 6. Load the Chrome Extension

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the `extension` folder from the project directory

### 7. Verify Installation

- The BLOOM extension icon should appear in your Chrome toolbar
- Click the icon to open the extension popup
- You should be able to upload documents and chat with the AI assistant

## Using Docker (Alternative)

Alternatively, you can run the backend using Docker Compose:

```bash
# From the project root
docker-compose up
```

This will start the backend service in a container using the provided Dockerfile.

## Usage

### Uploading Documents

1. Click the BLOOM extension icon in your Chrome toolbar
2. Select the "Documents" tab
3. Click "Select Files" or drag and drop PDF/DOCX files
4. Click "Upload All" to process your documents

### Scraping Moodle Content

1. Navigate to a Middlesex University Moodle course page
2. Click the BLOOM extension icon
3. Select the "Moodle Scraper" tab
4. Click "Start Scraping" to extract course documents

### Chatting with Documents

1. Click the BLOOM extension icon
2. Select "Open Chat Panel" or use the keyboard shortcut (Ctrl+Shift+B)
3. Choose a module from the dropdown (or "All Documents")
4. Type your question in the input field and press Enter

## Development

### Extension Structure

- `extension/`: Chrome extension files
  - `popup/`: Extension popup interface
  - `content/`: Content scripts for webpage integration
  - `panel/`: Side panel UI
  - `background/`: Background scripts
  - `manifest.json`: Extension configuration

### Backend Structure

- `backend/`: Python backend service
  - `app.py`: Main FastAPI application
  - `routes/`: API route definitions
  - `services/`: Business logic services
  - `utils/`: Utility functions
  - `config.py`: Configuration settings
