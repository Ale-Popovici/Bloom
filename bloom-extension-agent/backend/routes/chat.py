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
        # Use 'all' for searching across all collections when no module_code is specified
        if not query.module_code:
            collection_name = "all"
            logger.info(
                "No module specified, searching across all collections")
        else:
            collection_name = f"module_{query.module_code}"
            logger.info(f"Searching in module collection: {collection_name}")

        # Search for relevant document chunks
        results = search_documents(query.query, collection_name, k=8)

        logger.info(f"Found {len(results)} relevant chunks for query")

        # Generate response using OpenAI with session tracking
        # FIX: Add 'await' here to properly await the coroutine
        response = await generate_response(query.query, results, query.session_id)

        # Format sources for the response
        sources = []
        for result in results:
            if "metadata" in result:
                source = {
                    "document_id": result["metadata"]["document_id"],
                    "filename": result["metadata"]["filename"],
                    "relevance": result["score"]
                }

                # Add module_code if present in metadata
                if "module_code" in result["metadata"]:
                    source["module_code"] = result["metadata"]["module_code"]
                else:
                    source["module_code"] = "Unknown"

                sources.append(source)

        # Return top 3 sources
        return {
            "response": response,
            "sources": sources[:3]
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

        logger.info(f"Found {len(modules)} available modules")
        return {"modules": modules}
    except Exception as e:
        logger.error(f"Error listing available modules: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/debug/collections")
async def debug_collections():
    """
    Debug endpoint to inspect the vector database collections
    """
    try:
        # Get all collections from ChromaDB
        import chromadb
        from config import CHROMA_DB_DIR

        client = chromadb.PersistentClient(path=CHROMA_DB_DIR)
        collections = client.list_collections()

        collection_info = []

        for collection in collections:
            try:
                # Get basic stats for each collection
                count = collection.count()

                # Get sample items if available
                sample = []
                if count > 0:
                    # Try to get a small sample from the collection
                    sample_results = collection.peek(5)

                    if sample_results and "ids" in sample_results and sample_results["ids"]:
                        for i in range(min(3, len(sample_results["ids"]))):
                            sample_item = {
                                "id": sample_results["ids"][i] if i < len(sample_results["ids"]) else "N/A",
                                "metadata": sample_results["metadatas"][i] if "metadatas" in sample_results and i < len(sample_results["metadatas"]) else {},
                                "text_preview": sample_results["documents"][i][:100] + "..." if "documents" in sample_results and i < len(sample_results["documents"]) else "No text available"
                            }
                            sample.append(sample_item)

                collection_info.append({
                    "name": collection.name,
                    "count": count,
                    "sample": sample
                })
            except Exception as e:
                logger.error(
                    f"Error getting details for collection {collection.name}: {str(e)}")
                collection_info.append({
                    "name": collection.name,
                    "error": str(e)
                })

        return {
            "total_collections": len(collections),
            "collections": collection_info
        }
    except Exception as e:
        logger.error(f"Error debugging collections: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/debug/test_search")
async def debug_search(query: ChatQuery):
    """
    Debug endpoint to test search functionality without generating a response
    """
    try:
        # Determine which collection to search in
        if not query.module_code:
            collection_name = "all"
            logger.info(
                "No module specified, searching across all collections")
        else:
            collection_name = f"module_{query.module_code}"
            logger.info(f"Searching in module collection: {collection_name}")

        # Search for relevant document chunks
        from services.vector_store import search_documents
        results = search_documents(query.query, collection_name, k=8)

        logger.info(f"Found {len(results)} relevant chunks for query")

        # Format sources for the response
        sources = []
        for result in results:
            if "metadata" in result:
                source = {
                    "document_id": result["metadata"].get("document_id", "Unknown"),
                    "filename": result["metadata"].get("filename", "Unknown"),
                    "relevance": result.get("score", 1.0),
                    "text_preview": result.get("text", "")[:200] + "..." if len(result.get("text", "")) > 200 else result.get("text", ""),
                    "metadata": result["metadata"]
                }

                # Add module_code if present in metadata
                if "module_code" in result["metadata"]:
                    source["module_code"] = result["metadata"]["module_code"]
                else:
                    source["module_code"] = "Unknown"

                sources.append(source)

        # Return detailed debug information
        return {
            "query": query.query,
            "collection_searched": collection_name,
            "results_count": len(results),
            "sources": sources
        }
    except Exception as e:
        logger.error(f"Error in debug search endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
