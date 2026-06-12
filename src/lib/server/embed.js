/**
 * Embed an array of texts using Cloudflare Workers AI with the '@cf/baai/bge-m3' model.
 *
 * @param {Record<string, any>} env - Cloudflare platform env object
 * @param {string[]} texts - Array of text contents to embed
 * @returns {Promise<number[][]>} A promise resolving to an array of embedding vectors (1024 dimensions) matching the input order
 */
export async function embedTexts(env, texts) {
  if (!env || !env.AI) {
    throw new Error("Cloudflare AI binding 'AI' is missing from env");
  }

  if (!texts || texts.length === 0) {
    return [];
  }

  const BATCH_SIZE = 100;
  const embeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    try {
      const response = await env.AI.run('@cf/baai/bge-m3', { text: batch });
      if (!response || !response.data) {
        throw new Error("Workers AI returned an invalid response structure");
      }
      embeddings.push(...response.data);
    } catch (err) {
      console.error(`[Embed] Failed to generate embeddings for batch starting at index ${i}:`, err);
      throw err;
    }
  }

  return embeddings;
}
