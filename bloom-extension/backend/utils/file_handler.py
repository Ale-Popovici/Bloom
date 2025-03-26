import os
import tempfile
from fastapi import UploadFile


async def save_upload_file_temp(upload_file: UploadFile) -> str:
    """
    Save an upload file to a temporary file.
    Return the path to the temporary file.
    """
    try:
        suffix = os.path.splitext(upload_file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            content = await upload_file.read()
            temp_file.write(content)
            return temp_file.name
    except Exception as e:
        # Make sure to cleanup if there's an error
        if 'temp_file' in locals():
            os.unlink(temp_file.name)
        raise e
