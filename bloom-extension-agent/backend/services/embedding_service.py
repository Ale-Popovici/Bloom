import openai
from config import OPENAI_API_KEY, EMBEDDING_MODEL

# Set API key
openai.api_key = OPENAI_API_KEY


def get_embeddings(texts):
    """
    Generate embeddings for a list of texts using OpenAI's API
    """
    if not isinstance(texts, list):
        texts = [texts]

    response = openai.Embedding.create(
        input=texts,
        model=EMBEDDING_MODEL
    )

    # Extract embeddings from response
    embeddings = [data['embedding'] for data in response['data']]
    return embeddings
