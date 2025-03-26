from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import uvicorn

from services.document_processor import process_document
from services.vector_store import search_documents
from services.openai_service import generate_response

app = FastAPI(title="BLOOM API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatQuery(BaseModel):
    query: str


@app.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.pdf', '.docx')):
        raise HTTPException(
            status_code=400, detail="Only PDF and DOCX files are supported")

    try:
        # Process and store document in vector DB
        document_id = await process_document(file)
        return {"message": "Document processed successfully", "document_id": document_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
async def chat(query: ChatQuery):
    try:
        # Search for relevant document chunks
        results = search_documents(query.query, k=5)

        # Generate response using OpenAI
        response = generate_response(query.query, results)

        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
