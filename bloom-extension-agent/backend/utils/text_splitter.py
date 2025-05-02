from config import CHUNK_SIZE, CHUNK_OVERLAP


def split_text(text):
    """
    Split text into chunks with overlap
    """
    if not text:
        return []

    # Simple chunking by characters
    chunks = []
    i = 0
    while i < len(text):
        # Get chunk with specified size
        chunk = text[i:i + CHUNK_SIZE]
        chunks.append(chunk)

        # Move forward by chunk size minus overlap
        i += (CHUNK_SIZE - CHUNK_OVERLAP)

    return chunks
