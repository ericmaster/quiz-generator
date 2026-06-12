import { embedTexts } from './embed.js';
import { reciprocalRankFusion } from './rrf.js';

/**
 * Tokenizes the input query and wraps each alphanumeric token in double quotes
 * to generate a safe MATCH expression for SQLite FTS5.
 * This prevents operator symbols (*, :, -, etc.) or reserved words (AND, OR, NOT)
 * from causing syntax errors.
 *
 * @param {string} query
 * @returns {string}
 */
export function sanitizeFtsQuery(query) {
  if (!query) return '';
  // Match alphanumeric tokens (including Unicode letters and numbers)
  const matches = query.match(/[\p{L}\p{N}_]+/gu);
  if (!matches) return '';
  return matches.map(token => `"${token}"`).join(' ');
}

/**
 * Hybrid retrieval combining vector search (Vectorize) and keyword search (D1 FTS5)
 * fused together using Reciprocal Rank Fusion (RRF).
 *
 * @param {Record<string, any>} env - Cloudflare platform env object
 * @param {Object} options
 * @param {string} options.userId - ID of the user performing the search
 * @param {string} options.query - Search query string
 * @param {string[]} [options.documentIds] - Optional array of document IDs to filter by
 * @param {number} [options.topK=8] - Number of final hydrated results to return
 * @param {number} [options.candidateK=20] - Number of candidate results to retrieve from each search source
 * @returns {Promise<Array<{ chunkId: string, documentId: string, content: string, score: number }>>} Hydrated ranked search results
 */
export async function hybridSearch(env, { userId, query, documentIds, topK = 8, candidateK = 20 }) {
  if (!env || !env.DB) {
    throw new Error("Cloudflare D1 Database binding 'DB' is missing from env");
  }

  // If documentIds is provided and empty, no documents can match. Return early.
  if (documentIds && documentIds.length === 0) {
    return [];
  }

  // 1. Semantic Search (Vectorize)
  let semanticIds = [];
  if (!env.AI || !env.VECTORIZE) {
    console.warn("[Search] AI or VECTORIZE binding is missing from env. Degrading to keyword-only search.");
  } else if (query && query.trim()) {
    try {
      // Embed query
      const embeddings = await embedTexts(env, [query]);
      const queryVec = embeddings[0];

      // Build filter
      const filter = { user_id: userId };
      if (documentIds && documentIds.length > 0) {
        filter.document_id = { $in: documentIds };
      }

      // Query Vectorize. We only need the vector ids (content is hydrated from
      // D1), so returnMetadata stays 'none' — this also avoids Vectorize's
      // topK<=20 cap that applies when metadata/values are returned.
      const res = await env.VECTORIZE.query(queryVec, {
        topK: candidateK,
        filter,
        returnMetadata: 'none'
      });

      if (res && res.matches) {
        semanticIds = res.matches.map(match => match.id);
      }
    } catch (err) {
      console.error("[Search] Semantic search failed:", err);
      // Fallback: keep semanticIds empty and continue
    }
  }

  // 2. Keyword Search (D1 FTS5)
  let keywordIds = [];
  const safeMatchQuery = sanitizeFtsQuery(query);
  if (safeMatchQuery) {
    try {
      const params = [safeMatchQuery, userId];
      let sqlQuery = `
        SELECT c.id
        FROM chunk c
        JOIN document d ON c.document_id = d.id
        JOIN chunk_fts fts ON c.id = fts.chunk_id
        WHERE fts.chunk_fts MATCH ?
          AND d.user_id = ?
      `;

      if (documentIds && documentIds.length > 0) {
        const placeholders = documentIds.map(() => '?').join(',');
        sqlQuery += ` AND d.id IN (${placeholders})`;
        params.push(...documentIds);
      }

      sqlQuery += ` ORDER BY bm25(chunk_fts) ASC LIMIT ?`;
      params.push(candidateK);

      const { results } = await env.DB.prepare(sqlQuery).bind(...params).all();
      if (results) {
        keywordIds = results.map(row => row.id);
      }
    } catch (err) {
      console.error("[Search] Keyword search failed:", err);
      // Fallback: keep keywordIds empty and continue
    }
  }

  // 3. Reciprocal Rank Fusion (RRF)
  const fusedResults = reciprocalRankFusion([semanticIds, keywordIds], { k: 60, topK });
  const fusedIds = fusedResults.map(r => r.id);

  if (fusedIds.length === 0) {
    return [];
  }

  // 4. Hydration: fetch content and metadata from D1 while preserving RRF order
  try {
    const placeholders = fusedIds.map(() => '?').join(',');
    const params = [...fusedIds, userId];
    let fetchQuery = `
      SELECT c.id, c.document_id, c.content
      FROM chunk c
      JOIN document d ON c.document_id = d.id
      WHERE c.id IN (${placeholders})
        AND d.user_id = ?
    `;

    if (documentIds && documentIds.length > 0) {
      const docPlaceholders = documentIds.map(() => '?').join(',');
      fetchQuery += ` AND d.id IN (${docPlaceholders})`;
      params.push(...documentIds);
    }
    const { results } = await env.DB.prepare(fetchQuery).bind(...params).all();

    const recordMap = new Map();
    if (results) {
      results.forEach(row => {
        recordMap.set(row.id, row);
      });
    }

    return fusedResults.map(item => {
      const row = recordMap.get(item.id);
      if (!row) return null;
      return {
        chunkId: row.id,
        documentId: row.document_id,
        content: row.content,
        score: item.score
      };
    }).filter(Boolean);
  } catch (err) {
    console.error("[Search] Hydration failed:", err);
    return [];
  }
}
