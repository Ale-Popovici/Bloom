from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Query, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uvicorn
import uuid
from contextlib import asynccontextmanager
import logging

from services.document_processor import process_document, get_processing_status
from services.vector_store import search_documents
from services.openai_service import generate_response, clear_conversation, get_document_ids_for_session, get_conversation_history
# Import the routers
from routes.scraper import router as scraper_router
from routes.chat import router as chat_router

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="BLOOM API - Middlesex University",
    description="AI assistant for Middlesex University students to chat with their course documents",
    version="1.1.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Models
class DocumentRequest(BaseModel):
    document_id: str


# API routes
@app.post("/documents/upload")
async def upload_document(file: UploadFile = File(...), module_code: Optional[str] = None):
    """
    Upload and process a document (PDF or DOCX)
    """
    if not file.filename.lower().endswith(('.pdf', '.docx')):
        raise HTTPException(
            status_code=400, detail="Only PDF and DOCX files are supported")

    try:
        # Process document directly with optional module code
        document_id = await process_document(file, module_code)
        return {
            "message": "Document processed successfully",
            "document_id": document_id,
            "filename": file.filename,
            "module_code": module_code
        }
    except Exception as e:
        logger.error(f"Error processing document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/documents/status/{document_id}")
async def document_status(document_id: str):
    """
    Check the processing status of a document
    """
    status = get_processing_status(document_id)
    if status.get("status") == "not_found":
        raise HTTPException(status_code=404, detail="Document not found")
    return status


@app.get("/documents/list")
async def list_documents(session_id: Optional[str] = "default"):
    """
    List documents associated with a session
    """
    try:
        document_ids = get_document_ids_for_session(session_id)

        # Get document details (in a real implementation, you'd fetch these from a database)
        # Here we're just returning the IDs
        documents = [{"id": doc_id} for doc_id in document_ids]

        return {"documents": documents}
    except Exception as e:
        logger.error(f"Error listing documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    """
    Delete a document from the vector store
    """
    try:
        # This would need implementation in the vector_store service
        # For now, we'll return a not implemented error
        raise HTTPException(
            status_code=501, detail="Document deletion not yet implemented")
    except Exception as e:
        logger.error(f"Error deleting document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    return {"status": "healthy", "version": "1.1.0"}


# Include the routers
app.include_router(scraper_router)
app.include_router(chat_router)


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
