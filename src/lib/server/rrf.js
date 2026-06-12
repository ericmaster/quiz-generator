/**
 * Combines multiple ranked lists of IDs using the Reciprocal Rank Fusion (RRF) algorithm.
 * Formula: score = Sum over lists of (1 / (k + rank_in_list))
 * Where rank_in_list is 1-based (index + 1).
 *
 * @param {Array<Array<string|{id: string}>>} lists - Array of ranked arrays, where items can be IDs or objects with an 'id' property
 * @param {Object} [options={}] - Options object
 * @param {number} [options.k=60] - Constant parameter for RRF formula (default: 60)
 * @param {number} [options.topK] - Optional maximum number of results to return
 * @returns {Array<{ id: string, score: number }>} Fused and ranked list of objects containing 'id' and 'score'
 */
export function reciprocalRankFusion(lists, { k = 60, topK } = {}) {
  const scores = new Map();

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    // Only the best (first) rank of an id counts per list — a duplicate id
    // within the same list must not double-count its contribution.
    const seenInList = new Set();
    list.forEach((item, index) => {
      const id = item && typeof item === 'object' ? item.id : item;
      if (id === undefined || id === null || id === '') return;
      if (seenInList.has(id)) return;
      seenInList.add(id);

      const rank = index + 1; // 1-based rank
      const rrfContribution = 1 / (k + rank);

      const currentScore = scores.get(id) || 0;
      scores.set(id, currentScore + rrfContribution);
    });
  }

  // Convert map to array
  const results = Array.from(scores.entries()).map(([id, score]) => ({
    id,
    score
  }));

  // Sort descending by RRF score.
  // Deterministic tie-breaking: if scores are equal, sort alphabetically by ID.
  results.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 1e-9) {
      return b.score - a.score;
    }
    return String(a.id).localeCompare(String(b.id));
  });

  if (topK !== undefined && topK !== null) {
    return results.slice(0, topK);
  }

  return results;
}
