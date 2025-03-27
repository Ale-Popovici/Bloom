import os
import requests
import uuid
import asyncio
import logging
from urllib.parse import urljoin, urlparse
from typing import Dict, List, Any, Optional, Tuple
from bs4 import BeautifulSoup
import re
from datetime import datetime

from services.vector_store import add_documents
from services.document_processor import process_document
from utils.folder_manager import create_module_folders, save_file_to_module
from utils.text_splitter import split_text

# Set up logging with more detail
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Constants
MOODLE_BASE_URL = "https://mdx.mrooms.net"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

# Track scraping status
scraping_status = {}


class ScrapingTask:
    """Class to track a scraping task"""

    def __init__(self, url: str, module_code: str, module_name: str):
        self.task_id = str(uuid.uuid4())
        self.url = url
        self.module_code = module_code
        self.module_name = module_name
        self.start_time = datetime.now()
        self.status = "initializing"
        self.progress = 0
        self.files_found = []
        self.files_downloaded = []
        self.errors = []
        self.total_files = 0
        self.completed_files = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert task to dictionary for status reporting"""
        return {
            "task_id": self.task_id,
            "url": self.url,
            "module_code": self.module_code,
            "module_name": self.module_name,
            "start_time": self.start_time.isoformat(),
            "elapsed_time": (datetime.now() - self.start_time).total_seconds(),
            "status": self.status,
            "progress": self.progress,
            "files_found": len(self.files_found),
            "files_downloaded": len(self.files_downloaded),
            "errors": self.errors,
            "total_files": self.total_files,
            "completed_files": self.completed_files
        }


async def start_scraping_task(url: str, module_code: str, module_name: str, cookies: Dict[str, str]) -> str:
    """
    Start a new scraping task for a Moodle module page

    Args:
        url: The Moodle course page URL
        module_code: The module code (e.g., CST3350)
        module_name: The module name
        cookies: The cookies from the browser for authentication

    Returns:
        The task ID
    """
    # Create a new scraping task
    task = ScrapingTask(url, module_code, module_name)
    scraping_status[task.task_id] = task

    logger.info(
        f"Starting scraping task {task.task_id} for module {module_code} ({module_name})")

    # Start the scraping process in the background
    asyncio.create_task(scrape_moodle_course(task, cookies))

    return task.task_id


async def scrape_moodle_course(task: ScrapingTask, cookies: Dict[str, str]) -> None:
    """
    Scrape a Moodle course page and download resources

    Args:
        task: The scraping task
        cookies: The cookies from the browser for authentication
    """
    task.status = "scraping"
    logger.info(f"Starting scraping process for module {task.module_code}")

    try:
        # Create module folders
        module_dir = create_module_folders(task.module_code)
        logger.info(f"Created module directory: {module_dir}")

        # Determine collection name for this module
        collection_name = f"module_{task.module_code}"

        # Fetch the course page
        try:
            logger.info(f"Fetching course page: {task.url}")
            response = requests.get(task.url, headers=HEADERS, cookies=cookies)
            response.raise_for_status()

            # Parse HTML
            soup = BeautifulSoup(response.text, 'html.parser')
            logger.info(f"Successfully parsed Moodle page HTML")

            # Always extract HTML content from the page first
            logger.info(f"Extracting HTML content from Moodle page")
            page_content = extract_text_content(soup)

            if page_content:
                # Save extracted content as a text file
                content_filename = f"{task.module_code}_page_content.txt"
                content_path = os.path.join(
                    module_dir, "scraped", content_filename)

                with open(content_path, 'w', encoding='utf-8') as f:
                    f.write(page_content)

                logger.info(f"Saved page content to {content_path}")

                # Add page content to vector database
                document_id = await process_text_content(
                    page_content,
                    task.module_code,
                    task.module_name,
                    content_filename,
                    source_type="moodle_page"
                )
                logger.info(
                    f"Processed page content with document ID: {document_id}")
                task.files_downloaded.append(content_filename)
                task.completed_files += 1

            # Extract all PDF and DOCX links
            file_links = extract_file_links(soup, task.url)
            task.files_found = file_links
            task.total_files = len(file_links) + 1  # +1 for the page content

            logger.info(
                f"Found {len(file_links)} PDF/DOCX files in {task.module_code}")
            task.progress = 10

            # Download each file
            for i, file_info in enumerate(file_links):
                try:
                    filename, url = file_info
                    logger.info(
                        f"Processing file {i+1}/{len(file_links)}: {filename}")

                    success = await download_and_process_file(url, filename, task.module_code, module_dir, cookies)

                    if success:
                        task.files_downloaded.append(filename)
                        task.completed_files += 1
                        logger.info(f"Successfully processed {filename}")
                    else:
                        task.errors.append(f"Failed to process {filename}")
                        logger.error(f"Failed to process {filename}")

                    task.progress = 10 + int(85 * (i + 1) / len(file_links))
                except Exception as e:
                    logger.error(
                        f"Error downloading file {filename}: {str(e)}")
                    task.errors.append(
                        f"Failed to download {filename}: {str(e)}")

            task.status = "completed"
            task.progress = 100
            logger.info(f"Scraping task {task.task_id} completed successfully")

        except Exception as e:
            logger.error(f"Error fetching course page: {str(e)}")
            task.status = "failed"
            task.errors.append(f"Failed to fetch course page: {str(e)}")

    except Exception as e:
        logger.error(f"Error in scraping task: {str(e)}")
        task.status = "failed"
        task.errors.append(str(e))


def extract_file_links(soup: BeautifulSoup, base_url: str) -> List[Tuple[str, str]]:
    """
    Extract PDF and DOCX links from a Moodle page

    Args:
        soup: BeautifulSoup object of the page
        base_url: The base URL for resolving relative links

    Returns:
        List of tuples (filename, url)
    """
    file_links = []

    # Look for resource links in Moodle
    resource_links = []

    # Pattern 1: Standard resource links with icon classes
    for link in soup.find_all('a', href=True):
        # Look for PDF/DOCX icons or extensions
        if (link.find('img', class_=re.compile(r'(pdf|document)')) or
                re.search(r'\.(pdf|docx)($|\?)', link['href'], re.I)):

            url = urljoin(base_url, link['href'])
            filename = get_filename_from_link(link, url)
            if filename:
                resource_links.append((filename, url))

    # Pattern 2: Activity resources
    for activity in soup.find_all('div', class_='activity'):
        links = activity.find_all('a', href=True)
        for link in links:
            url = urljoin(base_url, link['href'])
            if is_document_url(url):
                filename = get_filename_from_link(link, url)
                if filename:
                    resource_links.append((filename, url))

    # Pattern 3: Modern Moodle activity instances
    for activity in soup.find_all('div', class_='activityinstance'):
        links = activity.find_all('a', href=True)
        for link in links:
            url = urljoin(base_url, link['href'])
            if is_document_url(url):
                filename = get_filename_from_link(link, url)
                if filename:
                    resource_links.append((filename, url))

    # Filter for PDF and DOCX files and remove duplicates
    seen_urls = set()
    for filename, url in resource_links:
        if url not in seen_urls and is_document_url(url):
            file_links.append((filename, url))
            seen_urls.add(url)

    return file_links


def get_filename_from_link(link, url: str) -> Optional[str]:
    """
    Extract a reasonable filename from a link element or URL

    Args:
        link: BeautifulSoup link element
        url: The URL of the file

    Returns:
        A filename or None if can't determine
    """
    # Try to get filename from URL
    url_path = urlparse(url).path
    filename = os.path.basename(url_path)

    # If filename has a query string, remove it
    filename = filename.split('?')[0]

    # If no extension, try to add one based on content
    if not re.search(r'\.(pdf|docx)$', filename, re.I):
        if 'pdf' in url.lower() or (link.find('img', class_=re.compile(r'pdf'))):
            filename += '.pdf'
        elif 'doc' in url.lower() or (link.find('img', class_=re.compile(r'document'))):
            filename += '.docx'
        else:
            # If still no extension, check link text
            link_text = link.get_text(strip=True)
            if re.search(r'pdf', link_text, re.I):
                filename += '.pdf'
            elif re.search(r'doc', link_text, re.I):
                filename += '.docx'

    # Clean up filename - remove invalid characters
    filename = re.sub(r'[^\w\-. ]', '_', filename)

    # If no valid filename could be determined
    if not filename or not re.search(r'\.(pdf|docx)$', filename, re.I):
        return None

    return filename


def is_document_url(url: str) -> bool:
    """
    Check if a URL points to a PDF or DOCX file

    Args:
        url: The URL to check

    Returns:
        True if it's a document URL, False otherwise
    """
    # Direct file links
    if re.search(r'\.(pdf|docx)($|\?)', url, re.I):
        return True

    # Moodle resource links
    if re.search(r'resource/view\.php', url, re.I):
        return True

    # Moodle pluginfile links (often used for files)
    if re.search(r'pluginfile\.php', url, re.I):
        return True

    return False


def extract_text_content(soup: BeautifulSoup) -> str:
    """
    Extract text content from a Moodle page

    Args:
        soup: BeautifulSoup object of the page

    Returns:
        Extracted text content
    """
    content = []

    # Extract page title
    title = soup.find('title')
    if title:
        content.append(f"# {title.get_text(strip=True)}\n")

    # Extract course header info
    header = soup.find('div', class_='page-header-headings')
    if header:
        content.append(f"## Course Header: {header.get_text(strip=True)}\n")

    # Extract course summary if available
    summary = soup.find('div', class_='course-summary')
    if summary:
        content.append("## Course Summary\n")
        content.append(summary.get_text(strip=True) + "\n")

    # Try to extract course information from course-content-header
    content_header = soup.find('div', class_='course-content-header')
    if content_header:
        content.append("## Course Content Header\n")
        content.append(content_header.get_text(strip=True) + "\n")

    # Extract main content
    main_content = soup.find('div', class_='course-content')
    if main_content:
        content.append("## Course Content\n")

        # Extract any introduction content
        intro = main_content.find('div', class_='summary')
        if intro:
            content.append("### Introduction\n")
            content.append(intro.get_text(strip=True) + "\n")

        # Extract section by section
        sections = main_content.find_all('li', class_='section')
        for section in sections:
            section_name = section.find('h3', class_='sectionname')
            if section_name:
                content.append(f"\n### {section_name.get_text(strip=True)}\n")
            else:
                content.append("\n### Unnamed Section\n")

            # Get section summary if available
            section_summary = section.find('div', class_='summary')
            if section_summary:
                content.append(section_summary.get_text(strip=True) + "\n")

            # Process activities
            activities = section.find_all(
                ['div', 'li'], class_=['activity', 'modtype'])
            for activity in activities:
                # Get activity name
                activity_name = activity.find(['span', 'div'], class_=[
                                              'instancename', 'activityname'])
                if activity_name:
                    content.append(
                        f"\n#### {activity_name.get_text(strip=True)}\n")

                # Get activity content
                for content_element in activity.find_all(['div', 'span'], class_=['contentafterlink', 'contentwithoutlink', 'activity-content']):
                    activity_text = content_element.get_text(strip=True)
                    if activity_text:
                        content.append(activity_text + "\n")

    # Look for announcements block
    announcements = soup.find(
        'div', class_=['block_news_items', 'block_latest_announcements'])
    if announcements:
        content.append("\n## Announcements\n")
        for item in announcements.find_all('div', class_='info'):
            content.append("- " + item.get_text(strip=True) + "\n")

    # Additional page-specific blocks
    for block in soup.find_all('div', class_='block'):
        # Find block title
        block_title = block.find('h3', class_='card-title')
        if block_title:
            title_text = block_title.get_text(strip=True)
            if title_text:
                content.append(f"\n## {title_text}\n")
                # Extract block content
                for content_element in block.find_all('div', class_='card-text'):
                    block_text = content_element.get_text(strip=True)
                    if block_text:
                        content.append(block_text + "\n")

    logger.info(
        f"Extracted {len(content)} sections of content from Moodle page")
    return "\n".join(content)


async def download_and_process_file(url: str, filename: str, module_code: str,
                                    module_dir: str, cookies: Dict[str, str]) -> bool:
    """
    Download a file and process it for the vector database

    Args:
        url: The file URL
        filename: The filename to save as
        module_code: The module code
        module_dir: The module directory
        cookies: The cookies for authentication

    Returns:
        True if successful, False otherwise
    """
    try:
        logger.info(f"Downloading {filename} from {url}")

        # Download the file
        response = requests.get(url, headers=HEADERS,
                                cookies=cookies, stream=True)
        response.raise_for_status()

        # Save the file
        file_path = await save_file_to_module(module_code, filename, response.content, "scraped")

        logger.info(f"Saved file to {file_path}")

        # Process the file for the vector database
        # Create a temporary UploadFile-like object
        class TempUploadFile:
            def __init__(self, filename, content):
                self.filename = filename
                self._content = content

            async def read(self):
                return self._content

            async def seek(self, position):
                # Add seek method for compatibility with document processor
                pass

        temp_file = TempUploadFile(filename, response.content)

        try:
            # Pass module_code explicitly to ensure it's stored in the correct collection
            document_id = await process_document(temp_file, module_code)
            logger.info(
                f"Successfully processed file with document ID: {document_id}")
            return True
        except Exception as e:
            logger.error(
                f"Error processing document with document_processor: {str(e)}")
            return False

    except Exception as e:
        logger.error(f"Error downloading file {filename}: {str(e)}")
        return False


async def process_text_content(content: str, module_code: str,
                               module_name: str, filename: str,
                               source_type: str = "scraped_text") -> str:
    """
    Process extracted text content for the vector database

    Args:
        content: The text content
        module_code: The module code
        module_name: The module name
        filename: The filename
        source_type: Type of source (moodle_page, scraped_text, etc.)

    Returns:
        Document ID
    """
    document_id = str(uuid.uuid4())
    collection_name = f"module_{module_code}"

    try:
        # Split text into chunks
        chunks = split_text(content)
        logger.info(f"Split text content into {len(chunks)} chunks")

        # Prepare data for Chroma DB
        texts = []
        metadatas = []

        for i, chunk in enumerate(chunks):
            texts.append(chunk)
            metadatas.append({
                "document_id": document_id,
                "filename": filename,
                "module_code": module_code,
                "module_name": module_name,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "source_type": source_type
            })

        # Add to vector database in the module collection
        try:
            add_documents(texts, metadatas, collection_name)
            logger.info(
                f"Added {len(texts)} chunks to collection '{collection_name}' for document ID {document_id}")
        except Exception as e:
            logger.error(
                f"Error adding chunks to collection '{collection_name}': {str(e)}")
            raise e

        return document_id

    except Exception as e:
        logger.error(f"Error processing text content: {str(e)}")
        raise e


def get_scraping_status(task_id: str) -> Dict[str, Any]:
    """
    Get the status of a scraping task

    Args:
        task_id: The task ID

    Returns:
        The task status
    """
    if task_id in scraping_status:
        return scraping_status[task_id].to_dict()
    return {"status": "not_found"}


def list_scraping_tasks() -> List[Dict[str, Any]]:
    """
    List all scraping tasks

    Returns:
        List of task statuses
    """
    return [task.to_dict() for task in scraping_status.values()]
