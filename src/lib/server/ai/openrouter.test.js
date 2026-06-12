// @vitest-environment node
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import { chatJSON, FREE_MODELS } from './openrouter.js';

describe('OpenRouter client utility', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('throws an error if OPENROUTER_API_KEY is missing', async () => {
    await expect(
      chatJSON({}, { system: 'sys', user: 'usr' })
    ).rejects.toThrow('OPENROUTER_API_KEY is missing or empty');

    await expect(
      chatJSON({ OPENROUTER_API_KEY: '   ' }, { system: 'sys', user: 'usr' })
    ).rejects.toThrow('OPENROUTER_API_KEY is missing or empty');
  });

  test('sends correct headers and body to OpenRouter', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: '["SvelteKit"]'
          }
        }
      ]
    };

    const fetchMock = vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const env = { OPENROUTER_API_KEY: 'test-api-key' };
    const result = await chatJSON(env, {
      system: 'You are a teacher.',
      user: 'Extract topics from: SvelteKit is awesome.',
      models: FREE_MODELS
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers['Authorization']).toBe('Bearer test-api-key');
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body);
    expect(body.models).toEqual(FREE_MODELS);
    expect(body.messages).toEqual([
      { role: 'system', content: 'You are a teacher.' },
      { role: 'user', content: 'Extract topics from: SvelteKit is awesome.' }
    ]);
    expect(body.response_format).toEqual({ type: 'json_object' });
    
    expect(result).toEqual(['SvelteKit']);
  });

  test('sends schema in response_format if provided', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: '{"topics": ["SvelteKit"]}'
          }
        }
      ]
    };

    const fetchMock = vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const env = { OPENROUTER_API_KEY: 'test-api-key' };
    const schema = {
      type: 'object',
      properties: {
        topics: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    };

    const result = await chatJSON(env, {
      system: 'You are a teacher.',
      user: 'Extract topics from: SvelteKit is awesome.',
      schema
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.schema).toEqual(schema);
    expect(result).toEqual({ topics: ['SvelteKit'] });
  });

  test('throws clear error on non-2xx API response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid API Key'
    });

    const env = { OPENROUTER_API_KEY: 'invalid-key' };
    await expect(
      chatJSON(env, { system: 'sys', user: 'usr' })
    ).rejects.toThrow('OpenRouter API error: 401 - Invalid API Key');
  });
});
