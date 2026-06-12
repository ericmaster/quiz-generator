// @vitest-environment node
import { expect, test, describe } from 'vitest';
import { chunkText } from './chunk.js';
import { parseTopicsResponse, parseJSONAny } from './ai/openrouter.js';

describe('Chunking utility', () => {
  test('handles empty or whitespace-only text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n  ')).toEqual([]);
  });

  test('short text returns a single chunk', () => {
    const text = 'Short text definition.';
    const result = chunkText(text, { chunkSize: 100, overlap: 10 });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      content: 'Short text definition.',
      chunkIndex: 0
    });
  });

  test('respects chunk size limit', () => {
    const text = 'Paragraph one text is here.\n\nParagraph two text is here.\n\nParagraph three text is here.';
    // Set chunk size small enough to force multiple chunks
    const result = chunkText(text, { chunkSize: 30, overlap: 5 });
    
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.content.length).toBeLessThanOrEqual(30);
      expect(typeof chunk.chunkIndex).toBe('number');
    }
  });

  test('produces overlapping chunks', () => {
    const text = 'This is a long sentence that should be split into multiple parts with overlap.';
    const result = chunkText(text, { chunkSize: 30, overlap: 15 });
    
    expect(result.length).toBeGreaterThan(1);
    // Verify that consecutive chunks share some words/characters
    for (let i = 0; i < result.length - 1; i++) {
      const current = result[i].content;
      const next = result[i + 1].content;
      
      // Look for a common substring
      let foundOverlap = false;
      const words = current.split(' ');
      for (const word of words) {
        if (word.length > 3 && next.includes(word)) {
          foundOverlap = true;
          break;
        }
      }
      expect(foundOverlap).toBe(true);
    }
  });

  test('maintains index ordering and generates sequential indices', () => {
    const text = 'First part of text. Second part of text. Third part of text. Fourth part of text.';
    const result = chunkText(text, { chunkSize: 25, overlap: 5 });

    expect(result.length).toBeGreaterThan(1);
    result.forEach((chunk, idx) => {
      expect(chunk.chunkIndex).toBe(idx);
    });
  });

  test('does not stack-overflow on large low-separator input (no whitespace)', () => {
    // Regression: a per-character split + spread previously overflowed the call
    // stack on inputs lacking paragraph/line/space boundaries (e.g. CJK text,
    // base64, minified content). Must hard-split iteratively instead.
    const noSpaces = 'a'.repeat(200000); // 200k chars, zero separators
    let result;
    expect(() => { result = chunkText(noSpaces); }).not.toThrow();
    expect(result.length).toBeGreaterThan(1);
    for (const c of result) expect(c.content.length).toBeLessThanOrEqual(1000);

    // CJK text without inter-word spaces (a normal real-world case).
    const cjk = '内容'.repeat(150000); // 300k chars
    let cjkResult;
    expect(() => { cjkResult = chunkText(cjk); }).not.toThrow();
    expect(cjkResult.length).toBeGreaterThan(1);

    // Long whitespace-separated giant tokens.
    const bigTokens = Array.from({ length: 30 }, () => 'x'.repeat(100000)).join(' ');
    expect(() => chunkText(bigTokens)).not.toThrow();
  });

  test('hard-splits a single oversized token and covers it fully', () => {
    const token = 'b'.repeat(5000);
    const result = chunkText(token, { chunkSize: 1000, overlap: 150 });
    expect(result.length).toBeGreaterThan(1);
    for (const c of result) expect(c.content.length).toBeLessThanOrEqual(1000);
    // Every character is 'b' and nothing is dropped — total covered length >= original.
    const totalLen = result.reduce((n, c) => n + c.content.length, 0);
    expect(totalLen).toBeGreaterThanOrEqual(5000);
  });
});

describe('Defensive JSON/Topic parser', () => {
  test('parses clean JSON array', () => {
    const input = '["Neural Networks", "Deep Learning", "Machine Learning"]';
    const result = parseTopicsResponse(input);
    expect(result).toEqual(["Neural Networks", "Deep Learning", "Machine Learning"]);
  });

  test('parses array wrapped in markdown code fences', () => {
    const input = `
Some introductory text...
\`\`\`json
[
  "Backpropagation",
  "Gradient Descent"
]
\`\`\`
Some footer text.
`;
    const result = parseTopicsResponse(input);
    expect(result).toEqual(["Backpropagation", "Gradient Descent"]);
  });

  test('parses array wrapped in standard code fences without json tag', () => {
    const input = `
\`\`\`
["SvelteKit", "Cloudflare Workers"]
\`\`\`
`;
    const result = parseTopicsResponse(input);
    expect(result).toEqual(["SvelteKit", "Cloudflare Workers"]);
  });

  test('deduplicates case-insensitively and trims whitespace', () => {
    const input = '["  neural networks  ", "Neural Networks", "deep learning", "deep learning"]';
    const result = parseTopicsResponse(input);
    expect(result).toEqual(["Neural Networks", "Deep Learning"]);
  });

  test('handles garbage gracefully and returns an empty array', () => {
    const input1 = 'Here is a list: 1. Neural Networks, 2. Deep Learning';
    const input2 = null;
    const input3 = '';
    
    expect(parseTopicsResponse(input1)).toEqual([]);
    expect(parseTopicsResponse(input2)).toEqual([]);
    expect(parseTopicsResponse(input3)).toEqual([]);
  });

  test('caps topic list length and individual topic character count', () => {
    const longTopic = 'a'.repeat(150);
    const input = JSON.stringify([
      longTopic,
      't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11'
    ]);
    const result = parseTopicsResponse(input);
    
    // Total count capped at 10
    expect(result.length).toBeLessThanOrEqual(10);
    // Capped long topic at 100 characters (Title Case starts with A, followed by a's)
    expect(result[0]).toBe('A' + 'a'.repeat(99));
  });
});
