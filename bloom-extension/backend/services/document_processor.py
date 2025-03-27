import os
import uuid
from fastapi import UploadFile
import fitz  # PyMuPDF
import docx
import tempfile
import logging
from typing import Dict, Any, Optional

from services.vector_store import get_collection, add_documents
from utils.text_splitter import split_text

# Set up logging with more detail
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Track processing status
processing_status = {}


async def process_document(file: UploadFile, module_code: Optional[str] = None) -> str:
    """
    Process a document and add it to the vector store.
    This is a simplified version that doesn't use a background queue.

    Args:
        file (UploadFile): The uploaded file
        module_code (str, optional): Module code for collection organization

    Returns:
        str: The document ID
    """
    # Generate unique ID for the document
    document_id = str(uuid.uuid4())

    # Determine collection name
    collection_name = f"module_{module_code}" if module_code else "bloom_documents"

    logger.info(
        f"Processing document '{file.filename}' with ID {document_id} for collection '{collection_name}'")

    # Update processing status
    processing_status[document_id] = {
        "filename": file.filename,
        "status": "processing",
        "progress": 0,
        "collection": collection_name
    }

    try:
        # Extract text based on file type
        if file.filename.lower().endswith('.pdf'):
            text = await extract_text_from_pdf(file)
            logger.info(
                f"Extracted {len(text)} characters from PDF '{file.filename}'")
        elif file.filename.lower().endswith('.docx'):
            text = await extract_text_from_docx(file)
            logger.info(
                f"Extracted {len(text)} characters from DOCX '{file.filename}'")
        else:
            raise ValueError(f"Unsupported file format: {file.filename}")

        # Update progress
        processing_status[document_id]["progress"] = 30

        # Split text into chunks
        chunks = split_text(text)
        logger.info(
            f"Split text into {len(chunks)} chunks for document '{file.filename}'")

        # Update progress
        processing_status[document_id]["progress"] = 50

        # Prepare data for Chroma DB
        texts = []
        metadatas = []

        for i, chunk in enumerate(chunks):
            texts.append(chunk)

            # Create metadata without None values
            metadata = {
                "document_id": document_id,
                "filename": file.filename,
                "chunk_index": i,
                "total_chunks": len(chunks)
            }

            # Only add module_code if it's not None
            if module_code is not None:
                metadata["module_code"] = module_code

            metadatas.append(metadata)

        # Update progress
        processing_status[document_id]["progress"] = 70

        # Add documents to ChromaDB using the specified collection
        try:
            add_documents(texts, metadatas, collection_name)
            logger.info(
                f"Successfully added {len(texts)} chunks to collection '{collection_name}' for document '{file.filename}'")
        except Exception as e:
            logger.error(
                f"Failed to add chunks to collection '{collection_name}': {str(e)}")
            raise e

        # Update status to complete
        processing_status[document_id]["status"] = "complete"
        processing_status[document_id]["progress"] = 100
        logger.info(
            f"Completed processing document '{file.filename}' with ID {document_id}")

        return document_id

    except Exception as e:
        # Update status to failed
        processing_status[document_id]["status"] = "failed"
        processing_status[document_id]["error"] = str(e)
        logger.error(f"Error processing document '{file.filename}': {str(e)}")
        raise e


async def extract_text_from_pdf(file: UploadFile) -> str:
    """
    Extract text from a PDF file

    Args:
        file (UploadFile): The PDF file

    Returns:
        str: Extracted text
    """
    # Save upload to temp file
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        logger.info(f"Saved PDF to temporary file: {temp_path}")

        # Extract text using PyMuPDF
        doc = fitz.open(temp_path)
        logger.info(f"Opened PDF with {len(doc)} pages")

        # More comprehensive extraction with metadata
        text_parts = []

        # Add document metadata if available
        metadata = doc.metadata
        if metadata:
            meta_text = "Document Metadata:\n"
            for key, value in metadata.items():
                if value:
                    meta_text += f"{key}: {value}\n"
            text_parts.append(meta_text)

        # Extract text from each page with page numbers
        for i, page in enumerate(doc):
            page_text = page.get_text()
            if page_text.strip():
                text_parts.append(f"Page {i+1}:\n{page_text}")

        # Extract table of contents if available
        toc = doc.get_toc()
        if toc:
            toc_text = "Table of Contents:\n"
            for level, title, page in toc:
                toc_text += f"{'  ' * (level-1)}- {title} (Page {page})\n"
            text_parts.append(toc_text)

        full_text = "\n\n".join(text_parts)
        logger.info(f"Extracted {len(full_text)} characters from PDF")
        return full_text

    except Exception as e:
        logger.error(f"Error extracting text from PDF: {str(e)}")
        raise e

    finally:
        # Clean up temp file
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
            logger.info(f"Removed temporary PDF file: {temp_path}")

        # Reset file pointer for potential reuse
        await file.seek(0)


async def extract_text_from_docx(file: UploadFile) -> str:
    """
    Extract text from a DOCX file

    Args:
        file (UploadFile): The DOCX file

    Returns:
        str: Extracted text
    """
    # Save upload to temp file
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        logger.info(f"Saved DOCX to temporary file: {temp_path}")

        # Extract text using python-docx
        doc = docx.Document(temp_path)
        logger.info(
            f"Opened DOCX with {len(doc.paragraphs)} paragraphs and {len(doc.tables)} tables")

        # Extract document properties
        core_properties = doc.core_properties
        text_parts = []

        # Add document metadata if available
        if core_properties:
            meta_text = "Document Metadata:\n"
            if core_properties.title:
                meta_text += f"Title: {core_properties.title}\n"
            if core_properties.author:
                meta_text += f"Author: {core_properties.author}\n"
            if core_properties.created:
                meta_text += f"Created: {core_properties.created}\n"
            if core_properties.modified:
                meta_text += f"Modified: {core_properties.modified}\n"
            if core_properties.subject:
                meta_text += f"Subject: {core_properties.subject}\n"
            if core_properties.keywords:
                meta_text += f"Keywords: {core_properties.keywords}\n"

            text_parts.append(meta_text)

        # Extract headings and paragraphs with structure
        current_heading = "Document Content"
        paragraphs_text = []

        for para in doc.paragraphs:
            if para.style.name.startswith('Heading'):
                if paragraphs_text:
                    text_parts.append(
                        f"{current_heading}:\n" + "\n".join(paragraphs_text))
                    paragraphs_text = []
                current_heading = para.text
            elif para.text.strip():
                paragraphs_text.append(para.text)

        # Add the last section
        if paragraphs_text:
            text_parts.append(f"{current_heading}:\n" +
                              "\n".join(paragraphs_text))

        # Extract tables
        for i, table in enumerate(doc.tables):
            table_text = f"Table {i+1}:\n"
            for row in table.rows:
                row_text = []
                for cell in row.cells:
                    row_text.append(cell.text.strip())
                table_text += " | ".join(row_text) + "\n"
            text_parts.append(table_text)

        full_text = "\n\n".join(text_parts)
        logger.info(f"Extracted {len(full_text)} characters from DOCX")
        return full_text

    except Exception as e:
        logger.error(f"Error extracting text from DOCX: {str(e)}")
        raise e

    finally:
        # Clean up temp file
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)
            logger.info(f"Removed temporary DOCX file: {temp_path}")

        # Reset file pointer for potential reuse
        await file.seek(0)


def get_processing_status(document_id: str) -> Dict[str, Any]:
    """
    Get the processing status for a document

    Args:
        document_id (str): The document ID

    Returns:
        Dict: Status information
    """
    if document_id in processing_status:
        return processing_status[document_id]
    return {"status": "not_found"}
