import openai
from config import OPENAI_API_KEY, CHAT_MODEL

# Set API key
openai.api_key = OPENAI_API_KEY


def generate_response(query, relevant_chunks):
    """
    Generate a response using GPT-4o based on the query and relevant document chunks
    """
    # Format context from relevant chunks
    context = "\n\n".join([chunk["text"] for chunk in relevant_chunks])

    # Build prompt with context
    system_message = """
    You are BLOOM, an intelligent assistant that helps users find information in their documents.
    Answer the user's question based on the provided context. If the information cannot be found 
    in the context, politely state that you don't have that information.
    """

    # Call OpenAI API
    response = openai.ChatCompletion.create(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": f"Context: {context}\n\nQuestion: {query}"}
        ],
        temperature=0.3,
        max_tokens=1000
    )

    return response.choices[0].message['content']
