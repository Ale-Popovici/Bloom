import openai
from config import OPENAI_API_KEY, CHAT_MODEL
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set API key
openai.api_key = OPENAI_API_KEY

# Maintain conversation history - persists between server restarts
conversation_history = {
    # "session_id": {
    #     "messages": [
    #         {"role": "system", "content": "..."},
    #         {"role": "user", "content": "..."},
    #         {"role": "assistant", "content": "..."}
    #     ],
    #     "document_ids": ["doc_id1", "doc_id2"]
    # }
}


def generate_response(query, relevant_chunks, session_id="default"):
    """
    Generate a response using GPT-4o based on the query, relevant document chunks,
    and conversation history.

    Args:
        query (str): The user's query
        relevant_chunks (list): List of relevant document chunks
        session_id (str): Identifier for the conversation session

    Returns:
        str: Generated response
    """
    # Log the session ID for debugging
    logger.info(f"Generating response for session: {session_id}")

    # Extract document IDs from the chunks for tracking purposes
    document_ids = list(set([chunk["metadata"]["document_id"]
                        for chunk in relevant_chunks if "metadata" in chunk and "document_id" in chunk["metadata"]]))

    # Format context from relevant chunks with metadata
    context_parts = []

    for i, chunk in enumerate(relevant_chunks):
        # Include metadata about the source document
        metadata = chunk.get("metadata", {})
        filename = metadata.get("filename", "Unknown")

        # Format the chunk with source information
        context_part = f"[Document: {filename}, Chunk {i+1}]\n{chunk['text']}\n"
        context_parts.append(context_part)

    # Combine all context parts
    context = "\n".join(context_parts)

    # Initialize conversation history if needed
    if session_id not in conversation_history:
        logger.info(
            f"Creating new conversation history for session: {session_id}")
        conversation_history[session_id] = {
            "messages": [],
            "document_ids": []
        }

    # Update document IDs for this session
    for doc_id in document_ids:
        if doc_id not in conversation_history[session_id]["document_ids"]:
            conversation_history[session_id]["document_ids"].append(doc_id)

    # Build system message with Middlesex University context
    system_message = """
    You are BLOOM, an intelligent assistant designed specifically for Middlesex University students.
    Your purpose is to help students find and understand information in their course materials.
    
    When answering questions:
    1. Draw information exclusively from the provided document excerpts
    2. Cite the document source when providing information
    3. If information cannot be found in the provided context, acknowledge this limitation
    4. Keep responses concise and student-focused, emphasizing practical information
    5. Use Middlesex University terminology when applicable
    6. Maintain a helpful, supportive, and educational tone
    7. Reference previous parts of the conversation when relevant to show continuity
    
    Approach complex topics by breaking them down into simpler components that students can understand.
    """

    # Construct conversation messages
    messages = []

    # Add system message
    if not conversation_history[session_id]["messages"]:
        messages.append({"role": "system", "content": system_message})
        conversation_history[session_id]["messages"].append(
            {"role": "system", "content": system_message})
    else:
        # Add existing system message
        messages.append(conversation_history[session_id]["messages"][0])

    # Add recent conversation history (limited to last 10 exchanges to manage context length)
    # Skip system message, take last 20
    history_messages = conversation_history[session_id]["messages"][1:][-20:]
    messages.extend(history_messages)

    # Add current query with context
    user_message = f"I need information from my course materials. Here are the relevant excerpts:\n\n{context}\n\nMy question is: {query}"
    messages.append({"role": "user", "content": user_message})

    # Log message count for debugging
    logger.info(
        f"Sending {len(messages)} messages to OpenAI API (including system message and new query)")

    try:
        # Call OpenAI API with enhanced parameters for conversation memory
        response = openai.ChatCompletion.create(
            model=CHAT_MODEL,
            messages=messages,
            temperature=0.2,  # Lower temperature for more factual responses
            max_tokens=1000,
            top_p=0.95,
            frequency_penalty=0.5,  # Increase frequency penalty to avoid repetition in conversations
            presence_penalty=0.5    # Increase presence penalty for more varied responses
        )

        assistant_message = response.choices[0].message['content']

        # Update conversation history with the actual query (not the context-enhanced one)
        conversation_history[session_id]["messages"].append(
            {"role": "user", "content": query})
        conversation_history[session_id]["messages"].append(
            {"role": "assistant", "content": assistant_message})

        # Keep conversation history manageable (maintain system message + last 20 exchanges)
        # system message + 40 exchange messages
        if len(conversation_history[session_id]["messages"]) > 41:
            # Keep system message and trim the oldest exchanges
            conversation_history[session_id]["messages"] = [
                # system message
                conversation_history[session_id]["messages"][0]
            ] + conversation_history[session_id]["messages"][-40:]  # last 40 messages

        return assistant_message

    except Exception as e:
        logger.error(f"Error generating response: {str(e)}")
        raise e


def clear_conversation(session_id="default"):
    """Clear the conversation history for a specific session"""
    if session_id in conversation_history:
        # Preserve document IDs but reset messages to only system message
        system_message = conversation_history[session_id]["messages"][
            0] if conversation_history[session_id]["messages"] else None
        conversation_history[session_id] = {
            "messages": [system_message] if system_message else [],
            "document_ids": conversation_history[session_id]["document_ids"]
        }
        logger.info(f"Cleared conversation history for session: {session_id}")
    return {"status": "Conversation cleared"}


def get_document_ids_for_session(session_id="default"):
    """Get document IDs associated with a session"""
    if session_id in conversation_history:
        return conversation_history[session_id]["document_ids"]
    return []


def get_conversation_history(session_id="default", max_messages=10):
    """Get recent conversation history for a session"""
    if session_id in conversation_history:
        # Skip system message and return most recent messages
        messages = conversation_history[session_id]["messages"][1:][-max_messages:]
        return [
            {
                "role": msg["role"],
                "content": msg["content"]
            }
            for msg in messages
        ]
    return []
