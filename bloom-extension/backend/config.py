import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
EMBEDDING_MODEL = "text-embedding-3-small"
CHAT_MODEL = "gpt-4.1"
CHROMA_DB_DIR = "../database/chroma_db"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
