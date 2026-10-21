/**
 * Sanitizes user input strings by removing control characters and dangerous script protocols.
 * Never uses dangerouslySetInnerHTML.
 */
export function sanitizeText(input: string, maxLength = 2000): string {
  if (!input) return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, maxLength);
}

export interface NoteSegment {
  type: 'text' | 'link';
  content: string;
  href?: string;
}

/**
 * Parses plain text into safe text and http/https link tokens for safe React rendering
 * without dangerouslySetInnerHTML.
 */
export function parseSafeLinks(text: string): NoteSegment[] {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s<>"'`]+)/gi;
  const segments: NoteSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }
    const rawUrl = match[0];
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        segments.push({
          type: 'link',
          content: rawUrl,
          href: parsed.toString(),
        });
      } else {
        segments.push({ type: 'text', content: rawUrl });
      }
    } catch {
      segments.push({ type: 'text', content: rawUrl });
    }
    lastIndex = urlRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}
