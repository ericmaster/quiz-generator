export const FREE_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-2-9b-it:free',
  'qwen/qwen-2.5-coder-32b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free'
];

/**
 * Defensively parses any JSON from a string, handling code blocks and prefix/suffix prose.
 * @param {string} text
 * @returns {any}
 */
export function parseJSONAny(text) {
  if (typeof text !== 'string') {
    throw new Error('Input must be a string');
  }
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (e) {}

  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = trimmed.match(codeBlockRegex);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1].trim());
    } catch (e2) {}
  }

  const firstCurly = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;
  if (firstCurly !== -1 && (firstBracket === -1 || firstCurly < firstBracket)) {
    startIdx = firstCurly;
    endIdx = trimmed.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = trimmed.lastIndexOf(']');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    try {
      return JSON.parse(trimmed.substring(startIdx, endIdx + 1));
    } catch (e3) {}
  }

  throw new Error('Failed to parse JSON: ' + text);
}

/**
 * Normalizes a topic name by capitalizing the first letter of each word to ensure consistent casing.
 * Keeps the rest of the letters as-is to preserve casings like "SvelteKit".
 * @param {string} name
 * @returns {string}
 */
export function normalizeTopicName(name) {
  if (typeof name !== 'string') return '';
  return name
    .trim()
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Defensively parses a list of topics from the assistant message, handling code fences,
 * trims, deduplication, and falls back to an empty array on garbage.
 * @param {any} text - The raw model output or already parsed object
 * @returns {string[]} Cleaned, trimmed, deduplicated topic names
 */
export function parseTopicsResponse(text) {
  if (text === null || text === undefined) {
    return [];
  }

  let parsed = null;
  if (typeof text === 'string') {
    try {
      parsed = parseJSONAny(text);
    } catch (err) {
      // Fallback on garbage
      return [];
    }
  } else {
    parsed = text;
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const topics = [];
  const seen = new Set();

  for (const item of parsed) {
    if (typeof item === 'string') {
      const normalized = normalizeTopicName(item);
      if (normalized !== '') {
        const lower = normalized.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          const capped = normalized.slice(0, 100);
          topics.push(capped);
        }
      }
    }
  }

  return topics.slice(0, 10);
}

/**
 * Sends a chat completions request to OpenRouter and returns the parsed JSON response.
 * 
 * @param {Record<string, any>} env - The platform environment containing OPENROUTER_API_KEY
 * @param {Object} options
 * @param {string} options.system - System prompt
 * @param {string} options.user - User prompt
 * @param {string[]} [options.models] - Optional list of fallback models
 * @param {Record<string, any>} [options.schema] - Optional JSON schema for structured outputs
 * @returns {Promise<any>} The parsed assistant message as JSON
 */
export async function chatJSON(env, { system, user, models = FREE_MODELS, schema }) {
  const apiKey = env?.OPENROUTER_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('OPENROUTER_API_KEY is missing or empty');
  }

  const body = {
    models,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.1,
  };

  if (schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'response_schema',
        strict: false,
        schema
      }
    };
  } else {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/quiz-generator',
      'X-Title': 'Quiz Generator AI Ingestion'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let responseText = '';
    try {
      responseText = await response.text();
    } catch (_) {}
    throw new Error(`OpenRouter API error: ${response.status} - ${responseText}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
    throw new Error('OpenRouter API returned an empty or invalid response structure');
  }

  const content = data.choices[0].message.content;
  return parseJSONAny(content);
}
