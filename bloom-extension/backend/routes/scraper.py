from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Body
from fastapi.responses import FileResponse
from typing import Dict, List, Any, Optional
import os
import logging
from pydantic import BaseModel

from services.scraper_service import (
    start_scraping_task,
    get_scraping_status,
    list_scraping_tasks,
    add_folder_documents,
    complete_folder_traversal
)
from utils.folder_manager import (
    create_module_folders,
    save_file_to_module,
    get_module_metadata,
    list_modules,
    delete_module,
    delete_module_file
)
from services.document_processor import process_document

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(
    prefix="/scraper",
    tags=["scraper"],
    responses={404: {"description": "Not found"}},
)


# Models
class StartScrapingRequest(BaseModel):
    url: str
    module_code: str
    module_name: str
    cookies: Dict[str, str]
    documents: Optional[List[Dict[str, str]]] = None
    has_folders: Optional[bool] = False


class FolderDocumentsRequest(BaseModel):
    task_id: str
    module_code: str
    folder_url: str
    documents: List[Dict[str, str]]


class CompleteFoldersRequest(BaseModel):
    task_id: str


class FileUploadRequest(BaseModel):
    module_code: str


class ModuleRequest(BaseModel):
    module_code: str


class FileRequest(BaseModel):
    module_code: str
    filename: str
    source_type: str


# Routes
@router.post("/start")
async def start_scraping(request: StartScrapingRequest):
    """Start scraping a Moodle course page"""
    try:
        task_id = await start_scraping_task(
            request.url,
            request.module_code,
            request.module_name,
            request.cookies,
            request.documents,
            request.has_folders
        )
        return {"task_id": task_id, "status": "started"}
    except Exception as e:
        logger.error(f"Error starting scraping task: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/add_folder_documents")
async def add_documents_from_folder(request: FolderDocumentsRequest):
    """Add documents from a folder to an existing scraping task"""
    try:
        logger.info(
            f"Received {len(request.documents)} documents from folder: {request.folder_url}")
        result = await add_folder_documents(
            request.task_id,
            request.module_code,
            request.folder_url,
            request.documents
        )
        return result
    except Exception as e:
        logger.error(f"Error adding folder documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/complete_folders")
async def complete_folders(request: CompleteFoldersRequest):
    """Mark folder traversal as complete for a task"""
    try:
        result = await complete_folder_traversal(request.task_id)
        return result
    except Exception as e:
        logger.error(f"Error completing folder traversal: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{task_id}")
async def check_scraping_status(task_id: str):
    """Check the status of a scraping task"""
    status = get_scraping_status(task_id)
    if status.get("status") == "not_found":
        raise HTTPException(status_code=404, detail="Task not found")
    return status


@router.get("/tasks")
async def get_all_tasks():
    """List all scraping tasks"""
    return {"tasks": list_scraping_tasks()}


@router.post("/upload")
async def upload_file(
    module_code: str = Form(...),
    file: UploadFile = File(...)
):
    """Upload a file to a module"""
    try:
        # Check file type - expanded to include PPT
        valid_extensions = ('.pdf', '.docx', '.doc', '.pptx', '.ppt')
        if not any(file.filename.lower().endswith(ext) for ext in valid_extensions):
            raise HTTPException(
                status_code=400,
                detail=f"Only {', '.join(valid_extensions)} files are supported"
            )

        # Read file content
        content = await file.read()

        # Save file to module
        file_path = await save_file_to_module(
            module_code,
            file.filename,
            content,
            "user_uploads"
        )

        # Process file for vector database
        document_id = await process_document(file, module_code)

        return {
            "module_code": module_code,
            "filename": file.filename,
            "file_path": file_path,
            "document_id": document_id
        }
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/modules")
async def get_modules():
    """List all modules"""
    try:
        modules = list_modules()
        return {"modules": modules}
    except Exception as e:
        logger.error(f"Error listing modules: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/modules/{module_code}")
async def get_module(module_code: str):
    """Get module details"""
    try:
        metadata = get_module_metadata(module_code)
        if not metadata.get("exists", True):
            raise HTTPException(status_code=404, detail="Module not found")
        return metadata
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting module {module_code}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/modules/{module_code}")
async def remove_module(module_code: str):
    """Delete a module"""
    try:
        success = delete_module(module_code)
        if not success:
            raise HTTPException(status_code=404, detail="Module not found")
        return {"status": "success", "message": f"Module {module_code} deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting module {module_code}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/files")
async def remove_file(request: FileRequest):
    """Delete a file from a module"""
    try:
        success = delete_module_file(
            request.module_code,
            request.filename,
            request.source_type
        )
        if not success:
            raise HTTPException(status_code=404, detail="File not found")
        return {
            "status": "success",
            "message": f"File {request.filename} deleted from {request.module_code}"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/files/{module_code}/{source_type}/{filename}")
async def download_file(module_code: str, source_type: str, filename: str):
    """Download a file from a module"""
    try:
        # Construct file path
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        file_path = os.path.join(
            base_dir,
            "data",
            "modules",
            module_code,
            source_type,
            filename
        )

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")

        return FileResponse(file_path, filename=filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
