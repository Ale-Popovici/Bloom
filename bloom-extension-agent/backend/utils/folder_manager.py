import os
import shutil
import logging
from typing import List, Dict, Any, Optional
import json
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Base directory for all module data
# This will be relative to the backend directory
BASE_DATA_DIR = os.path.join(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))), "data")

# Module metadata file name
MODULE_METADATA_FILE = "module_info.json"


def ensure_base_directory():
    """Create the base data directory if it doesn't exist"""
    if not os.path.exists(BASE_DATA_DIR):
        os.makedirs(BASE_DATA_DIR, exist_ok=True)
        logger.info(f"Created base data directory: {BASE_DATA_DIR}")

    # Create modules directory if it doesn't exist
    modules_dir = os.path.join(BASE_DATA_DIR, "modules")
    if not os.path.exists(modules_dir):
        os.makedirs(modules_dir, exist_ok=True)
        logger.info(f"Created modules directory: {modules_dir}")


def create_module_folders(module_code: str) -> str:
    """
    Create folder structure for a module

    Args:
        module_code: The module code (e.g., CST3350)

    Returns:
        The path to the module directory
    """
    # Ensure base directory exists
    ensure_base_directory()

    # Create module directory
    module_dir = os.path.join(BASE_DATA_DIR, "modules", module_code)
    os.makedirs(module_dir, exist_ok=True)

    # Create subdirectories
    scraped_dir = os.path.join(module_dir, "scraped")
    os.makedirs(scraped_dir, exist_ok=True)

    user_uploads_dir = os.path.join(module_dir, "user_uploads")
    os.makedirs(user_uploads_dir, exist_ok=True)

    logger.info(f"Created module directories for {module_code}")
    return module_dir


async def save_file_to_module(module_code: str, filename: str, content: bytes,
                              source_type: str = "user_upload") -> str:
    """
    Save a file to the appropriate module folder

    Args:
        module_code: The module code
        filename: The filename
        content: The file content as bytes
        source_type: Either "scraped" or "user_upload"

    Returns:
        The path to the saved file
    """
    # Ensure module folders exist
    module_dir = create_module_folders(module_code)

    # Determine the target folder
    if source_type == "scraped":
        target_dir = os.path.join(module_dir, "scraped")
    else:
        target_dir = os.path.join(module_dir, "user_uploads")

    # Ensure unique filename by adding timestamp if file already exists
    file_path = os.path.join(target_dir, filename)
    if os.path.exists(file_path):
        # Split filename and extension
        name, ext = os.path.splitext(filename)
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{name}_{timestamp}{ext}"
        file_path = os.path.join(target_dir, filename)

    # Save the file
    with open(file_path, 'wb') as f:
        f.write(content)

    logger.info(f"Saved {source_type} file to {file_path}")

    # Update module metadata
    update_module_file_metadata(module_code, filename, source_type)

    return file_path


def update_module_file_metadata(module_code: str, filename: str, source_type: str):
    """
    Update module metadata with new file information

    Args:
        module_code: The module code
        filename: The filename
        source_type: Either "scraped" or "user_upload"
    """
    module_dir = os.path.join(BASE_DATA_DIR, "modules", module_code)
    metadata_file = os.path.join(module_dir, MODULE_METADATA_FILE)

    # Initialize metadata if it doesn't exist
    if not os.path.exists(metadata_file):
        metadata = {
            "module_code": module_code,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "files": {
                "scraped": [],
                "user_uploads": []
            }
        }
    else:
        # Load existing metadata
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)
            metadata["updated_at"] = datetime.now().isoformat()

    # Add file to metadata if not already present
    file_list = metadata["files"][source_type]
    if filename not in file_list:
        file_list.append(filename)

        # Save updated metadata
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)

        logger.info(
            f"Updated metadata for {module_code} with new file {filename}")


def get_module_metadata(module_code: str) -> Dict[str, Any]:
    """
    Get metadata for a module

    Args:
        module_code: The module code

    Returns:
        The module metadata
    """
    module_dir = os.path.join(BASE_DATA_DIR, "modules", module_code)
    metadata_file = os.path.join(module_dir, MODULE_METADATA_FILE)

    if not os.path.exists(metadata_file):
        return {
            "module_code": module_code,
            "exists": False,
            "error": "Module not found"
        }

    with open(metadata_file, 'r') as f:
        metadata = json.load(f)

    return metadata


def list_modules() -> List[Dict[str, Any]]:
    """
    List all modules with basic metadata

    Returns:
        List of module information
    """
    ensure_base_directory()

    modules_dir = os.path.join(BASE_DATA_DIR, "modules")
    modules = []

    for module_code in os.listdir(modules_dir):
        module_dir = os.path.join(modules_dir, module_code)
        if os.path.isdir(module_dir):
            metadata_file = os.path.join(module_dir, MODULE_METADATA_FILE)

            if os.path.exists(metadata_file):
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                modules.append(metadata)
            else:
                # Basic info if no metadata file
                modules.append({
                    "module_code": module_code,
                    "created_at": "",
                    "updated_at": "",
                    "files": {
                        "scraped": [],
                        "user_uploads": []
                    }
                })

    return modules


def delete_module(module_code: str) -> bool:
    """
    Delete a module and all its files

    Args:
        module_code: The module code

    Returns:
        True if successful, False otherwise
    """
    module_dir = os.path.join(BASE_DATA_DIR, "modules", module_code)

    if not os.path.exists(module_dir):
        logger.warning(f"Module {module_code} not found")
        return False

    try:
        shutil.rmtree(module_dir)
        logger.info(f"Deleted module {module_code}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete module {module_code}: {str(e)}")
        return False


def delete_module_file(module_code: str, filename: str, source_type: str) -> bool:
    """
    Delete a file from a module

    Args:
        module_code: The module code
        filename: The filename
        source_type: Either "scraped" or "user_upload"

    Returns:
        True if successful, False otherwise
    """
    module_dir = os.path.join(BASE_DATA_DIR, "modules", module_code)
    file_path = os.path.join(module_dir, source_type, filename)

    if not os.path.exists(file_path):
        logger.warning(
            f"File {filename} not found in {module_code}/{source_type}")
        return False

    try:
        os.remove(file_path)
        logger.info(
            f"Deleted file {filename} from {module_code}/{source_type}")

        # Update metadata
        metadata_file = os.path.join(module_dir, MODULE_METADATA_FILE)
        if os.path.exists(metadata_file):
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)

            if filename in metadata["files"][source_type]:
                metadata["files"][source_type].remove(filename)
                metadata["updated_at"] = datetime.now().isoformat()

                with open(metadata_file, 'w') as f:
                    json.dump(metadata, f, indent=2)

        return True
    except Exception as e:
        logger.error(
            f"Failed to delete file {filename} from {module_code}/{source_type}: {str(e)}")
        return False
