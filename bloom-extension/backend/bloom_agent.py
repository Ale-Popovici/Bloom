"""
BLOOM Document Analysis Agent

This module provides agent capabilities to the BLOOM extension,
enabling autonomous document analysis tasks like summarization,
key point extraction, study guide creation, and document comparison.
"""

import re
from typing import Dict, List, Any, Optional
import logging
import openai
from config import OPENAI_API_KEY, CHAT_MODEL

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set API key
openai.api_key = OPENAI_API_KEY


class BloomAgent:
    """
    Enhanced agent capabilities for BLOOM Assistant
    """

    def __init__(self, session_id: str = "default"):
        self.session_id = session_id
        self.agent_history = []

    async def process_request(self, query: str, relevant_chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Process a user query to determine if agent actions are needed

        Args:
            query: User's query text
            relevant_chunks: Relevant document chunks

        Returns:
            Dictionary with response and any agent actions
        """
        # Detect if this is an agent action request
        action_type = self._detect_action_type(query)

        if not action_type:
            # Not an agent request, return None to use standard response
            return None

        # Execute the appropriate agent action
        if action_type == "summarize":
            return await self._execute_summarize_action(query, relevant_chunks)
        elif action_type == "extract_key_points":
            return await self._execute_extract_points_action(query, relevant_chunks)
        elif action_type == "create_study_guide":
            return await self._execute_study_guide_action(query, relevant_chunks)
        elif action_type == "compare_documents":
            return await self._execute_compare_action(query, relevant_chunks)

        # Fallback to regular response if action not implemented
        return None

    def _detect_action_type(self, query: str) -> Optional[str]:
        """
        Detect if the query is requesting an agent action

        Args:
            query: User's query text

        Returns:
            Action type or None
        """
        query_lower = query.lower()

        # Check for summarization requests
        if re.search(r'\b(summarize|summary|summarization)\b', query_lower):
            return "summarize"

        # Check for key points extraction
        if re.search(r'\b(key points|main points|important points|extract points)\b', query_lower):
            return "extract_key_points"

        # Check for study guide creation
        if re.search(r'\b(study guide|study notes|create notes|make notes)\b', query_lower):
            return "create_study_guide"

        # Check for document comparison
        if re.search(r'\b(compare|comparison|differences|similarities)\b', query_lower):
            return "compare_documents"

        return None

    async def _execute_summarize_action(self, query: str, relevant_chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Execute document summarization action

        Args:
            query: User's query text
            relevant_chunks: Relevant document chunks

        Returns:
            Summary response
        """
        # Format context from relevant chunks
        context = self._format_chunks_for_context(relevant_chunks)

        # Record action in history
        self.agent_history.append(
            {"action": "summarize", "chunks_count": len(relevant_chunks)})

        # Create system message for summarization
        system_message = """
        You are BLOOM Agent, an intelligent document analysis assistant for Middlesex University students.
        Your task is to provide a concise and comprehensive summary of the document excerpts provided.
        
        Guidelines for summarization:
        1. Focus on the main themes, arguments, and conclusions
        2. Maintain academic tone and terminology
        3. Organize by topics rather than by source documents
        4. Keep the summary to 3-5 paragraphs
        5. Include a bullet-point list of key takeaways at the end
        6. Cite the document sources when mentioning specific information
        
        Format your response with markdown, including headings and bullet points as appropriate.
        """

        # Create user message with summarization request
        user_message = f"""
        I need you to summarize these document excerpts:
        
        {context}
        
        My specific question is: {query}
        """

        # Call OpenAI with enhanced parameters for summarization
        response = await self._call_openai(system_message, user_message)

        # Format and return the agent response
        return {
            "agent_action": "summarize",
            "response": response,
            "metadata": {
                "chunks_analyzed": len(relevant_chunks),
                "document_count": len(set(chunk.get("metadata", {}).get("document_id", "") for chunk in relevant_chunks))
            }
        }

    async def _execute_extract_points_action(self, query: str, relevant_chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Execute key points extraction action

        Args:
            query: User's query text
            relevant_chunks: Relevant document chunks

        Returns:
            Key points response
        """
        # Format context from relevant chunks
        context = self._format_chunks_for_context(relevant_chunks)

        # Record action in history
        self.agent_history.append(
            {"action": "extract_key_points", "chunks_count": len(relevant_chunks)})

        # Create system message for key points extraction
        system_message = """
        You are BLOOM Agent, an intelligent document analysis assistant for Middlesex University students.
        Your task is to extract and organize the key points from the document excerpts provided.
        
        Guidelines for key points extraction:
        1. Identify the most important concepts, arguments, and findings
        2. Organize points by category or theme
        3. Include source attribution for each point
        4. Prioritize clarity and educational value
        5. Format as a hierarchical bullet point list
        6. Include academic definitions where relevant
        
        Format your response with markdown, using headings and nested bullet points.
        """

        # Create user message with key points request
        user_message = f"""
        I need you to extract the key points from these document excerpts:
        
        {context}
        
        My specific question is: {query}
        """

        # Call OpenAI with enhanced parameters
        response = await self._call_openai(system_message, user_message)

        # Format and return the agent response
        return {
            "agent_action": "extract_key_points",
            "response": response,
            "metadata": {
                "chunks_analyzed": len(relevant_chunks),
                "document_count": len(set(chunk.get("metadata", {}).get("document_id", "") for chunk in relevant_chunks))
            }
        }

    async def _execute_study_guide_action(self, query: str, relevant_chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Execute study guide creation action

        Args:
            query: User's query text
            relevant_chunks: Relevant document chunks

        Returns:
            Study guide response
        """
        # Format context from relevant chunks
        context = self._format_chunks_for_context(relevant_chunks)

        # Record action in history
        self.agent_history.append(
            {"action": "create_study_guide", "chunks_count": len(relevant_chunks)})

        # Create system message for study guide creation
        system_message = """
        You are BLOOM Agent, an intelligent document analysis assistant for Middlesex University students.
        Your task is to create a comprehensive study guide from the document excerpts provided.
        
        Guidelines for study guide creation:
        1. Organize content by topics and subtopics with clear headings
        2. Include definitions, explanations, and examples
        3. Add potential exam questions with brief answer outlines
        4. Create memory aids like acronyms or mnemonic devices where helpful
        5. Include a glossary of key terms
        6. Add suggestions for further study or practice
        
        Format your response with markdown, using headings, bullet points, tables, and other formatting to enhance readability.
        """

        # Create user message with study guide request
        user_message = f"""
        I need you to create a study guide from these document excerpts:
        
        {context}
        
        My specific request is: {query}
        """

        # Call OpenAI with enhanced parameters
        response = await self._call_openai(system_message, user_message)

        # Format and return the agent response
        return {
            "agent_action": "create_study_guide",
            "response": response,
            "metadata": {
                "chunks_analyzed": len(relevant_chunks),
                "document_count": len(set(chunk.get("metadata", {}).get("document_id", "") for chunk in relevant_chunks))
            }
        }

    async def _execute_compare_action(self, query: str, relevant_chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Execute document comparison action

        Args:
            query: User's query text
            relevant_chunks: Relevant document chunks

        Returns:
            Comparison response
        """
        # Group chunks by document
        documents = {}
        for chunk in relevant_chunks:
            doc_id = chunk.get("metadata", {}).get("document_id", "unknown")
            doc_name = chunk.get("metadata", {}).get(
                "filename", "Unknown Document")

            if doc_id not in documents:
                documents[doc_id] = {
                    "name": doc_name,
                    "content": [],
                    "metadata": chunk.get("metadata", {})
                }

            documents[doc_id]["content"].append(chunk.get("text", ""))

        # Need at least 2 documents to compare
        if len(documents) < 2:
            return {
                "agent_action": "compare_documents",
                "response": "I cannot perform a comparison because I only found content from one document. Please try again with a query that involves multiple documents.",
                "metadata": {
                    "error": "insufficient_documents",
                    "documents_found": len(documents)
                }
            }

        # Format documents for comparison
        docs_context = ""
        for doc_id, doc in documents.items():
            docs_context += f"\n\nDOCUMENT: {doc['name']}\n"
            docs_context += "\n".join(doc["content"])

        # Record action in history
        self.agent_history.append(
            {"action": "compare_documents", "documents": list(documents.keys())})

        # Create system message for document comparison
        system_message = """
        You are BLOOM Agent, an intelligent document analysis assistant for Middlesex University students.
        Your task is to compare and contrast the content from multiple documents.
        
        Guidelines for document comparison:
        1. Identify key similarities and differences between the documents
        2. Organize comparison by themes or topics
        3. Create a structured analysis with clear headings
        4. Include a comparison table or matrix where appropriate
        5. Highlight any contradictions or complementary information
        6. Provide a synthesis that integrates perspectives from all documents
        
        Format your response with markdown, using headings, tables, and bullet points as appropriate.
        """

        # Create user message with comparison request
        user_message = f"""
        I need you to compare these documents:
        
        {docs_context}
        
        My specific question is: {query}
        """

        # Call OpenAI with enhanced parameters
        response = await self._call_openai(system_message, user_message)

        # Format and return the agent response
        return {
            "agent_action": "compare_documents",
            "response": response,
            "metadata": {
                "documents_compared": len(documents),
                "document_names": [doc["name"] for doc in documents.values()]
            }
        }

    def _format_chunks_for_context(self, chunks: List[Dict[str, Any]]) -> str:
        """
        Format document chunks into a context string

        Args:
            chunks: List of document chunks

        Returns:
            Formatted context string
        """
        context_parts = []

        for i, chunk in enumerate(chunks):
            # Include metadata about the source document
            metadata = chunk.get("metadata", {})
            filename = metadata.get("filename", "Unknown")

            # Format the chunk with source information
            context_part = f"[Document: {filename}, Chunk {i+1}]\n{chunk.get('text', '')}\n"
            context_parts.append(context_part)

        # Combine all context parts
        return "\n".join(context_parts)

    async def _call_openai(self, system_message: str, user_message: str) -> str:
        """
        Call OpenAI API with the provided messages

        Args:
            system_message: System message
            user_message: User message

        Returns:
            Generated response
        """
        try:
            messages = [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ]

            # FIX: Add 'await' before the openai call
            response = await openai.ChatCompletion.acreate(
                model=CHAT_MODEL,
                messages=messages,
                temperature=0.3,  # Lower temperature for more structured and factual responses
                max_tokens=1500,
                top_p=0.95,
                frequency_penalty=0.0,
                presence_penalty=0.0
            )

            return response.choices[0].message['content']
        except Exception as e:
            logger.error(f"Error calling OpenAI API: {str(e)}")
            return f"I encountered an error while processing your request. Please try again."
