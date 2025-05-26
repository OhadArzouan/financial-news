import { parse } from 'node-html-parser';

/**
 * Process content to extract text, handling both plain text and HTML
 */
export function processContent(content: string | null): string | null {
  if (!content) return null;

  // Check if content contains HTML tags
  if (/<[a-z][\s\S]*>/i.test(content)) {
    try {
      // Parse HTML content
      const root = parse(content);
      
      // Get all text nodes
      const textNodes: string[] = [];
      const walk = (node: any) => {
        if (node.nodeType === 3) { // Text node
          const text = node.text.trim();
          if (text) textNodes.push(text);
        } else if (node.childNodes) {
          node.childNodes.forEach(walk);
        }
        // Add newline after block elements
        if (node.tagName && /^(div|p|br|h[1-6]|ul|ol|li|blockquote|pre)$/i.test(node.tagName)) {
          textNodes.push('\n');
        }
      };
      
      walk(root);
      
      // Join text nodes and clean up extra whitespace
      return textNodes
        .join(' ')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
    } catch (error) {
      console.error('Error processing HTML content:', error);
      return content; // Return original content if parsing fails
    }
  }

  // If it's plain text, return as is
  return content;
}
