import chromadb
import os
from config import CHROMA_DB_DIR
from services.embedding_service import get_embeddings

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
    Search for similar documents in the specified collection
    """
    collection = get_collection(collection_name)
    results = collection.query(
        query_texts=[query],
        n_results=k
    )

    # Format results in a way that's compatible with our application
    formatted_results = []
    for i in range(len(results["ids"][0])):
        formatted_results.append({
            "id": results["ids"][0][i],
            "text": results["documents"][0][i],
            "metadata": results["metadatas"][0][i],
            "score": results["distances"][0][i] if "distances" in results else 1.0
        })

    return formatted_results


def add_documents(texts, metadatas, collection_name="bloom_documents"):
    """
    Add documents to the specified collection
    """
    collection = get_collection(collection_name)

    # Generate IDs based on metadata
    ids = []
    for i, metadata in enumerate(metadatas):
        document_id = metadata.get("document_id", "doc")
        chunk_index = metadata.get("chunk_index", i)
        ids.append(f"{document_id}_{chunk_index}")

    # Add to collection
    collection.add(
        ids=ids,
        documents=texts,
        metadatas=metadatas
    )

    return ids
