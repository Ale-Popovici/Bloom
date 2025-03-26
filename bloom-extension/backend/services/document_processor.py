import os
import uuid
from fastapi import UploadFile
import fitz  # PyMuPDF
import docx
import tempfile

from services.vector_store import get_vector_db
from utils.text_splitter import split_text
from services.embedding_service import get_embeddings


async def process_document(file: UploadFile):
    # Generate unique ID for the document
    document_id = str(uuid.uuid4())

    # Extract text based on file type
    if file.filename.lower().endswith('.pdf'):
        text = await extract_text_from_pdf(file)
    elif file.filename.lower().endswith('.docx'):
        text = await extract_text_from_docx(file)
    else:
        raise ValueError("Unsupported file format")

    # Split text into chunks
    chunks = split_text(text)

    # Get vector DB
    db = get_vector_db()

    # Prepare data for Chroma DB
    ids = []
    texts = []
    metadatas = []

    for i, chunk in enumerate(chunks):
        chunk_id = f"{document_id}_{i}"
        ids.append(chunk_id)
        texts.append(chunk)
        metadatas.append({
            "document_id": document_id,
            "filename": file.filename,
            "chunk_index": i
        })

    # Add documents to ChromaDB using the correct method
    db.add(
        ids=ids,
        documents=texts,
        metadatas=metadatas
    )

    return document_id


async def extract_text_from_pdf(file: UploadFile):
    # Save upload to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
        temp_file.write(await file.read())
        temp_path = temp_file.name

    try:
        # Extract text using PyMuPDF
        doc = fitz.open(temp_path)
        text = ""
        for page in doc:
            text += page.get_text()
        return text
    finally:
        # Clean up temp file
        os.unlink(temp_path)


async def extract_text_from_docx(file: UploadFile):
    # Save upload to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as temp_file:
        temp_file.write(await file.read())
        temp_path = temp_file.name

    try:
        # Extract text using python-docx
        doc = docx.Document(temp_path)
        text = ""
        for para in doc.paragraphs:
            text += para.text + "\n"
        return text
    finally:
        # Clean up temp file
        os.unlink(temp_path)
