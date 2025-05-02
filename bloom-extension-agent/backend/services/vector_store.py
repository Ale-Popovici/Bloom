import chromadb
import os
from config import CHROMA_DB_DIR
from services.embedding_service import get_embeddings
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ensure DB directory exists
os.makedirs(CHROMA_DB_DIR, exist_ok=True)

# Create a proper embedding function class


class OpenAIEmbeddingFunction:
    def __call__(self, input):
        """
        The __call__ method needs to have a parameter named exactly 'input'
        """
        return get_embeddings(input)


# Collections cache to avoid multiple instances
_collections = {}


def get_collection(collection_name="bloom_documents"):
    """
    Returns a collection for the specified module (or default)
    """
    global _collections
    if collection_name not in _collections:
        # Initialize ChromaDB client
        client = chromadb.PersistentClient(path=CHROMA_DB_DIR)

        # Get or create collection with proper embedding function
        _collections[collection_name] = client.get_or_create_collection(
            name=collection_name,
            embedding_function=OpenAIEmbeddingFunction()
        )

    return _collections[collection_name]


def list_collections():
    """
    List all available collections/modules
    """
    client = chromadb.PersistentClient(path=CHROMA_DB_DIR)
    collections = client.list_collections()
    return [collection.name for collection in collections]


def search_documents(query, collection_name="bloom_documents", k=5):
    """
    Search for similar documents in the specified collection or across all collections
    """
    # Check if we should search all collections
    if collection_name == "all" or not collection_name:
        logger.info(f"Searching across all collections for query: {query}")
        return search_all_collections(query, k)
    else:
        logger.info(
            f"Searching in collection {collection_name} for query: {query}")
        collection = get_collection(collection_name)
        try:
            results = collection.query(
                query_texts=[query],
                n_results=k
            )
            return format_results(results)
        except Exception as e:
            logger.error(
                f"Error searching collection {collection_name}: {str(e)}")
            return []


def search_all_collections(query, k=5):
    """
    Search across all collections and return combined results with additional debugging
    """
    client = chromadb.PersistentClient(path=CHROMA_DB_DIR)
    collections = client.list_collections()
    all_results = []

    logger.info(f"Found {len(collections)} collections to search")

    # List all collections for debugging
    collection_names = [c.name for c in collections]
    logger.info(f"Available collections: {collection_names}")

    # If no collections, return empty results
    if not collections:
        logger.warning("No collections found in the database!")
        return []

    # Search in default collection if it exists
    default_collection_exists = any(
        c.name == "bloom_documents" for c in collections)
    if default_collection_exists:
        try:
            default_results = get_collection("bloom_documents").query(
                query_texts=[query],
                n_results=k
            )
            default_formatted = format_results(default_results)
            logger.info(
                f"Found {len(default_formatted)} results in default collection")

            # Additional debugging for default collection
            if default_formatted:
                logger.info(
                    f"Sample result from default collection: {default_formatted[0]['text'][:100]}...")
                logger.info(f"Metadata: {default_formatted[0]['metadata']}")
            else:
                logger.warning("Default collection returned no results!")

            all_results.extend(default_formatted)
        except Exception as e:
            logger.error(f"Error searching default collection: {str(e)}")

    # Search in all module collections
    module_collections = [
        c for c in collections if c.name.startswith("module_")]
    logger.info(
        f"Found {len(module_collections)} module collections to search")

    for collection in module_collections:
        try:
            logger.info(f"Searching collection: {collection.name}")
            module_collection = get_collection(collection.name)
            module_results = module_collection.query(
                query_texts=[query],
                n_results=k
            )
            module_formatted = format_results(module_results)
            logger.info(
                f"Found {len(module_formatted)} results in {collection.name}")

            # Additional debugging for module collection
            if module_formatted:
                logger.info(
                    f"Sample result from {collection.name}: {module_formatted[0]['text'][:100]}...")
                logger.info(f"Metadata: {module_formatted[0]['metadata']}")
            else:
                logger.warning(
                    f"Collection {collection.name} returned no results!")

            all_results.extend(module_formatted)
        except Exception as e:
            logger.error(
                f"Error searching collection {collection.name}: {str(e)}")

    # Sort by relevance (lower distance means more relevant)
    all_results.sort(key=lambda x: x.get("score", 1.0))

    # Take top k results
    final_results = all_results[:k]
    logger.info(
        f"Returning top {len(final_results)} results across all collections")

    # Log summary of results
    if final_results:
        sources = {}
        for result in final_results:
            collection = result.get("metadata", {}).get(
                "module_code", "default")
            sources[collection] = sources.get(collection, 0) + 1

        logger.info(f"Results by source: {sources}")
    else:
        logger.warning("No results found across any collections!")

    return final_results


def format_results(results):
    """Format ChromaDB results into a standardized format with better error handling"""
    formatted_results = []

    # Basic validation of results
    if not results:
        logger.warning("Empty results object received")
        return []

    if "ids" not in results:
        logger.warning("Results object has no 'ids' field")
        return []

    if not results["ids"] or not results["ids"][0]:
        logger.warning("Results contains empty IDs")
        return []

    # Check that all required fields are present
    required_fields = ["ids", "documents", "metadatas"]
    for field in required_fields:
        if field not in results:
            logger.error(f"Results missing required field: {field}")
            return []

    # Verify field lengths match
    field_lengths = {
        field: len(results[field][0]
                   ) if results[field] and results[field][0] else 0
        for field in required_fields
    }

    if len(set(field_lengths.values())) > 1:
        logger.error(f"Result field length mismatch: {field_lengths}")
        # Try to continue with the minimum length
        min_length = min(field_lengths.values())
    else:
        min_length = field_lengths["ids"]

    # Format the results
    for i in range(min_length):
        try:
            result = {
                "id": results["ids"][0][i],
                "text": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
                "score": results["distances"][0][i] if "distances" in results and results["distances"][0] else 1.0
            }

            # Verify basic result integrity
            if not result["text"] or len(result["text"].strip()) < 10:
                logger.warning(f"Result {i} has very little text content")

            if not result["metadata"]:
                logger.warning(f"Result {i} has no metadata")
                result["metadata"] = {"warning": "No metadata available"}

            formatted_results.append(result)
        except Exception as e:
            logger.error(f"Error formatting result {i}: {str(e)}")

    return formatted_results


def add_documents(texts, metadatas, collection_name="bloom_documents"):
    """
    Add documents to the specified collection
    """
    if not texts or not metadatas:
        logger.warning(
            f"Attempted to add empty documents to {collection_name}")
        return []

    logger.info(
        f"Adding {len(texts)} documents to collection {collection_name}")
    collection = get_collection(collection_name)

    # Generate IDs based on metadata
    ids = []
    for i, metadata in enumerate(metadatas):
        document_id = metadata.get("document_id", "doc")
        chunk_index = metadata.get("chunk_index", i)
        ids.append(f"{document_id}_{chunk_index}")

    # Add to collection
    try:
        collection.add(
            ids=ids,
            documents=texts,
            metadatas=metadatas
        )
        logger.info(
            f"Successfully added {len(texts)} documents to {collection_name}")
    except Exception as e:
        logger.error(f"Error adding documents to {collection_name}: {str(e)}")
        raise e

    return ids
