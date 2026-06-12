import { describe, expect, test, vi } from 'vitest';
import { extractDocumentText, validateFile, MAX_DOCUMENT_BYTES } from './parse.js';

vi.mock('unpdf', () => {
  return {
    getDocumentProxy: vi.fn().mockResolvedValue({ id: 'mock-pdf-proxy' }),
    extractText: vi.fn().mockResolvedValue({ totalPages: 1, text: 'extracted pdf content' }),
  };
});

describe('extractDocumentText', () => {
  test('extracts text from plain text file', async () => {
    const file = new File(['hello world'], 'test.txt', { type: 'text/plain' });
    const result = await extractDocumentText(file);
    expect(result.text).toBe('hello world');
    expect(result.mimeType).toBe('text/plain');
  });

  test('extracts text from markdown file', async () => {
    const file = new File(['# Hello Markdown'], 'test.md', { type: 'text/markdown' });
    const result = await extractDocumentText(file);
    expect(result.text).toBe('# Hello Markdown');
    expect(result.mimeType).toBe('text/markdown');
  });

  test('extracts text from markdown file via extension', async () => {
    const file = new File(['# Hello markdown file'], 'test.md', { type: '' });
    const result = await extractDocumentText(file);
    expect(result.text).toBe('# Hello markdown file');
    expect(result.mimeType).toBe('text/markdown');
  });

  test('extracts text from PDF file', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'test.pdf', { type: 'application/pdf' });
    const result = await extractDocumentText(file);
    
    expect(result.text).toBe('extracted pdf content');
    expect(result.mimeType).toBe('application/pdf');
    
    const { getDocumentProxy, extractText } = await import('unpdf');
    expect(getDocumentProxy).toHaveBeenCalled();
    expect(extractText).toHaveBeenCalledWith({ id: 'mock-pdf-proxy' }, { mergePages: true });
  });

  test('rejects unsupported file types', async () => {
    const file = new File(['some data'], 'image.png', { type: 'image/png' });
    await expect(extractDocumentText(file)).rejects.toThrow('Unsupported file type');
  });
});

describe('validateFile (client-side guard)', () => {
  /** Build a fake File-like object with a controllable size without allocating bytes. */
  function fakeFile(name, type, size) {
    return { name, type, size };
  }

  test('accepts a PDF / TXT / MD within the size cap', () => {
    expect(validateFile(fakeFile('a.pdf', 'application/pdf', 1000))).toEqual({ ok: true, reason: 'none' });
    expect(validateFile(fakeFile('a.txt', 'text/plain', 1000))).toEqual({ ok: true, reason: 'none' });
    expect(validateFile(fakeFile('a.md', 'text/markdown', 1000))).toEqual({ ok: true, reason: 'none' });
    // type missing but extension recognized
    expect(validateFile(fakeFile('a.md', '', 1000))).toEqual({ ok: true, reason: 'none' });
  });

  test('rejects files over the 5MB cap before any extraction', () => {
    const tooBig = fakeFile('big.pdf', 'application/pdf', MAX_DOCUMENT_BYTES + 1);
    expect(validateFile(tooBig)).toEqual({ ok: false, reason: 'too_large' });
  });

  test('rejects unsupported types', () => {
    expect(validateFile(fakeFile('image.png', 'image/png', 1000))).toEqual({ ok: false, reason: 'unsupported' });
  });

  test('rejects a missing file', () => {
    expect(validateFile(null)).toEqual({ ok: false, reason: 'missing' });
  });
});
