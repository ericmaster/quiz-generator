/**
 * Recursively splits a string into chunks of a maximum size with a specified overlap.
 * Tries splitting on paragraph (\n\n), line (\n), word ( ), and character boundaries.
 * 
 * @param {string} text - The input text to split
 * @param {Object} [options]
 * @param {number} [options.chunkSize] - Target size of each chunk in characters (default: 1000)
 * @param {number} [options.overlap] - Target overlap size in characters (default: 150)
 * @returns {Array<{ content: string, chunkIndex: number }>} Array of chunk objects
 */
export function chunkText(text, { chunkSize = 1000, overlap = 150 } = {}) {
  if (typeof text !== 'string') {
    throw new Error('Input text must be a string');
  }

  if (text.trim() === '') {
    return [];
  }

  // Ensure overlap is smaller than chunkSize
  const effectiveOverlap = Math.min(overlap, chunkSize - 1);
  // Boundary separators tried in order. There is NO '' separator: once these are
  // exhausted (separatorIdx >= length) we hard-split the raw string directly.
  // (Splitting into a per-character array and spreading it would overflow the
  // call stack / argument limit on large low-separator inputs, e.g. CJK text
  // without spaces, base64, or minified content.)
  const separators = ['\n\n', '\n', ' '];

  /**
   * Recursively splits the text using separators, falling back to a direct
   * iterative hard split. Runs in O(n) without building per-character arrays.
   * @param {string} txt
   * @param {number} separatorIdx
   * @returns {string[]}
   */
  function getSplits(txt, separatorIdx) {
    if (txt.length <= chunkSize) {
      return [txt];
    }

    if (separatorIdx >= separators.length) {
      // Hard split on chunkSize, iterating directly over the string.
      const result = [];
      let i = 0;
      const stride = chunkSize - effectiveOverlap;
      while (i < txt.length) {
        result.push(txt.substring(i, i + chunkSize));
        i += stride;
      }
      return result;
    }

    const separator = separators[separatorIdx];
    const parts = txt.split(separator);

    const finalSplits = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      // Append the separator back to keep spacing/newlines intact, except for the last item
      const partWithSep = i < parts.length - 1 ? part + separator : part;

      if (partWithSep.length > chunkSize) {
        // Accumulate without spread (`push(...arr)`) to avoid the argument-count
        // limit on very large sub-splits.
        const sub = getSplits(partWithSep, separatorIdx + 1);
        for (let j = 0; j < sub.length; j++) finalSplits.push(sub[j]);
      } else if (partWithSep !== '') {
        finalSplits.push(partWithSep);
      }
    }
    return finalSplits;
  }

  const splits = getSplits(text, 0);

  const chunks = [];
  let currentChunk = '';

  for (const split of splits) {
    if (split === '') continue;

    if (currentChunk === '') {
      currentChunk = split;
    } else if (currentChunk.length + split.length <= chunkSize) {
      currentChunk += split;
    } else {
      chunks.push(currentChunk);

      // Determine overlap from the end of currentChunk
      let overlapStart = currentChunk.length - effectiveOverlap;
      if (overlapStart < 0) {
        overlapStart = 0;
      }
      
      let overlapText = currentChunk.substring(overlapStart);
      
      // Try to find a logical boundary (space or newline) in the overlap text to avoid splitting words
      const spaceIdx = overlapText.indexOf(' ');
      const newlineIdx = overlapText.indexOf('\n');
      let bestIdx = -1;
      
      if (spaceIdx !== -1 && newlineIdx !== -1) {
        bestIdx = Math.min(spaceIdx, newlineIdx);
      } else if (spaceIdx !== -1) {
        bestIdx = spaceIdx;
      } else if (newlineIdx !== -1) {
        bestIdx = newlineIdx;
      }

      // If a boundary is found in the first half of the overlap, align to it
      if (bestIdx !== -1 && bestIdx < overlapText.length / 2) {
        overlapText = overlapText.substring(bestIdx + 1);
      }

      currentChunk = overlapText + split;
      
      // Safeguard against chunks exceeding chunkSize
      if (currentChunk.length > chunkSize) {
        currentChunk = currentChunk.substring(currentChunk.length - chunkSize);
      }
    }
  }

  if (currentChunk !== '') {
    chunks.push(currentChunk);
  }

  return chunks
    .map(c => c.trim())
    .filter(c => c !== '')
    .map((content, chunkIndex) => ({
      content,
      chunkIndex
    }));
}
