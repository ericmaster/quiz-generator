import { getDocumentProxy, extractText } from 'unpdf';

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

/**
 * Pure validation of a candidate upload File against the 5MB size cap and the
 * supported types (PDF, TXT, MD). Returns a machine-readable reason so the UI
 * can format its own message; kept pure so it is unit-testable and reused as
 * the client-side guard before any extraction/upload happens.
 * @param {{ size:number, name?:string, type?:string } | null | undefined} file
 * @returns {{ ok: boolean, reason: 'none'|'missing'|'too_large'|'unsupported' }}
 */
export function validateFile(file) {
  if (!file) return { ok: false, reason: 'missing' };
  if (file.size > MAX_DOCUMENT_BYTES) return { ok: false, reason: 'too_large' };
  const name = (file.name || '').toLowerCase();
  const type = file.type || '';
  const isPdf = type === 'application/pdf' || name.endsWith('.pdf');
  const isText =
    type === 'text/plain' ||
    type === 'text/markdown' ||
    name.endsWith('.txt') ||
    name.endsWith('.md');
  if (!isPdf && !isText) return { ok: false, reason: 'unsupported' };
  return { ok: true, reason: 'none' };
}

/**
 * Extracts plain text from a supported file (PDF, TXT, MD).
 * Assumes the file is within the size limit (MAX_DOCUMENT_BYTES).
 * 
 * @param {File} file - The file to extract text from
 * @returns {Promise<{ text: string, mimeType: string }>}
 */
export async function extractDocumentText(file) {
  const name = file.name || '';
  const type = file.type || '';

  const isPdf = type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
  const isText = type === 'text/plain' || type === 'text/markdown' || name.toLowerCase().endsWith('.txt') || name.toLowerCase().endsWith('.md');

  if (isPdf) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
    const { text } = await extractText(pdf, { mergePages: true });
    // If text is an array or something else, handle it. extractText with mergePages: true returns string.
    return { text: typeof text === 'string' ? text : (Array.isArray(text) ? text.join('\n') : ''), mimeType: 'application/pdf' };
  } else if (isText) {
    const text = await file.text();
    const mimeType = name.toLowerCase().endsWith('.md') || type === 'text/markdown' ? 'text/markdown' : 'text/plain';
    return { text: text || '', mimeType };
  } else {
    throw new Error(`Unsupported file type: ${type || 'unknown'} (${name})`);
  }
}
