from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging

from services.vector_store import search_documents, list_collections
from services.openai_service import generate_response, clear_conversation, get_document_ids_for_session, get_conversation_history
from utils.folder_manager import list_modules, get_module_metadata

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
    responses={404: {"description": "Not found"}},
)


class ChatQuery(BaseModel):
    query: str
    session_id: Optional[str] = "default"
    module_code: Optional[str] = None


class SessionRequest(BaseModel):
    session_id: str = "default"


@router.post("")
async def chat(query: ChatQuery):
    """
    Chat with documents using GPT-4o with conversation memory
    """
    try:
        logger.info(
            f"Received chat query: {query.query} for session: {query.session_id}, module: {query.module_code or 'all'}")

        # Determine which collection to search in
        collection_name = f"module_{query.module_code}" if query.module_code else "bloom_documents"

        # Search for relevant document chunks
        results = search_documents(query.query, collection_name, k=8)

        # Generate response using OpenAI with session tracking
        response = generate_response(query.query, results, query.session_id)

        return {
            "response": response,
            "sources": [
                {
                    "document_id": result["metadata"]["document_id"],
                    "filename": result["metadata"]["filename"],
                    "module_code": result["metadata"].get("module_code", "Unknown"),
                    "relevance": result["score"]
                }
                for result in results if "metadata" in result
            ][:3]  # Return top 3 sources
        }
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear")
async def clear_chat_history(session: SessionRequest):
    """
    Clear the chat history for a session
    """
    try:
        result = clear_conversation(session.session_id)
        return result
    except Exception as e:
        logger.error(f"Error clearing chat history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_chat_history(session_id: str = "default", max_messages: int = 10):
    """
    Get the chat history for a session
    """
    try:
        history = get_conversation_history(session_id, max_messages)
        return {"history": history}
    except Exception as e:
        logger.error(f"Error getting chat history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/modules")
async def get_available_modules():
    """
    Get a list of available modules for the chat dropdown
    """
    try:
        # Try to get modules from both ChromaDB collections and file system
        modules = []

        # Get modules from ChromaDB collections
        collections = list_collections()
        for collection in collections:
            if collection.startswith("module_"):
                module_code = collection.replace("module_", "")
                if not any(m["code"] == module_code for m in modules):
                    modules.append(
                        {"code": module_code, "name": f"Module {module_code}"})

        # Get modules from file system
        file_modules = list_modules()
        for module in file_modules:
            module_code = module.get("module_code")
            if module_code and not any(m["code"] == module_code for m in modules):
                modules.append({"code": module_code, "name": module.get(
                    "module_name", f"Module {module_code}")})

        return {"modules": modules}
    except Exception as e:
        logger.error(f"Error listing available modules: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
