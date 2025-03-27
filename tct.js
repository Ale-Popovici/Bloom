// BLOOM - Panel-specific script that runs inside the iframe

// Communication with the parent window
function sendToParent(action, data = {}) {
  window.parent.postMessage({ action, ...data }, "*");
}

// DOM elements
// Element definitions...

// Helper function to escape HTML in code blocks
function escapeHTML(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Markdown parser function with citation footnotes
function parseMarkdown(text) {
  if (!text) return "";

  // First, save any citations to process them separately
  let citations = [];
  let citationIndex = 0;

  // Regular expression to match citations in parentheses that mention files/chunks
  const citationRegex =
    /\(((?:[^()]+(?:File\.pdf|\.docx|\.pdf|Chunk|Chunks))[^()]*)\)/g;

  // Replace citations with placeholders
  text = text.replace(citationRegex, function (match, citation) {
    citations.push(citation);
    return `||FOOTNOTE_CITATION_${citationIndex++}||`;
  });

  // More markdown processing...

  // Create footnotes list
  let footnotesList = "";
  citationIndex = 0;

  // Process academic-style footnote citations
  text = text.replace(
    /\|\|FOOTNOTE_CITATION_(\d+)\|\|/g,
    function (match, index) {
      const i = parseInt(index);
      footnotesList += `<div class="bloom-footnote-item"><span class="bloom-footnote-number">[${
        i + 1
      }]</span> ${citations[i]}</div>`;
      return `<span class="bloom-footnote-citation"></span>`;
    }
  );

  // Add footnotes list if we used the footnote style
  if (footnotesList) {
    text += `<div class="bloom-footnotes">${footnotesList}</div>`;
  }

  return text;
}

// Rest of the file...
