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


# Singleton pattern to avoid multiple instances
_vector_db = None


def get_vector_db():
    """
    Returns a singleton instance of the ChromaDB client
    """
    global _vector_db
    if _vector_db is None:
        # Initialize ChromaDB client
        client = chromadb.PersistentClient(path=CHROMA_DB_DIR)

        # Get or create collection with proper embedding function
        _vector_db = client.get_or_create_collection(
            name="bloom_documents",
            embedding_function=OpenAIEmbeddingFunction()
        )

    return _vector_db


def search_documents(query, k=5):
    """
    Search for similar documents in the vector DB
    """
    db = get_vector_db()
    results = db.query(
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
