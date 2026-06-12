// @vitest-environment node
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { MAX_DOCUMENT_BYTES } from '$lib/parse.js';

// Setup mock for database helper using vi.hoisted to prevent hoisting errors
const { mockInsert, mockValues } = vi.hoisted(() => {
  const mockValues = vi.fn().mockResolvedValue({});
  const mockInsert = vi.fn().mockReturnValue({
    values: mockValues
  });
  return { mockInsert, mockValues };
});

vi.mock('$lib/server/db.js', () => {
  return {
    getDb: vi.fn().mockReturnValue({
      insert: mockInsert
    })
  };
});

// Import POST after mocks have been defined/hoisted
import { POST } from './+server.js';

describe('POST /api/upload', () => {
  let mockEvent;
  let mockBucket;

  beforeEach(() => {
    vi.clearAllMocks();

    mockBucket = {
      put: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({})
    };

    mockEvent = {
      locals: {
        user: { id: 'user-123' }
      },
      request: {
        json: vi.fn().mockResolvedValue({
          filename: 'test.txt',
          mimeType: 'text/plain',
          sizeBytes: 1024,
          text: 'hello world'
        })
      },
      platform: {
        env: {
          DOCS_BUCKET: mockBucket,
          DB: {} // dummy D1 database object
        }
      }
    };
  });

  test('returns 401 if user is not authenticated', async () => {
    mockEvent.locals.user = null;
    const res = await POST(mockEvent);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('returns 400 if text is empty', async () => {
    mockEvent.request.json.mockResolvedValue({
      filename: 'test.txt',
      mimeType: 'text/plain',
      sizeBytes: 1024,
      text: '   '
    });
    const res = await POST(mockEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Text content is required');
  });

  test('returns 413 if sizeBytes exceeds MAX_DOCUMENT_BYTES', async () => {
    mockEvent.request.json.mockResolvedValue({
      filename: 'test.txt',
      mimeType: 'text/plain',
      sizeBytes: MAX_DOCUMENT_BYTES + 1,
      text: 'hello world'
    });
    const res = await POST(mockEvent);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toContain('exceeds the 5MB');
  });

  test('returns 413 if text byte length exceeds MAX_DOCUMENT_BYTES', async () => {
    const hugeText = 'a'.repeat(MAX_DOCUMENT_BYTES + 1);
    mockEvent.request.json.mockResolvedValue({
      filename: 'test.txt',
      mimeType: 'text/plain',
      sizeBytes: 1024,
      text: hugeText
    });
    const res = await POST(mockEvent);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toContain('text size exceeds');
  });

  test('returns 400 if filename is missing or invalid', async () => {
    mockEvent.request.json.mockResolvedValue({
      filename: '',
      mimeType: 'text/plain',
      sizeBytes: 1024,
      text: 'hello'
    });
    const res = await POST(mockEvent);
    expect(res.status).toBe(400);
  });

  test('returns 400 if mimeType is unsupported', async () => {
    mockEvent.request.json.mockResolvedValue({
      filename: 'image.png',
      mimeType: 'image/png',
      sizeBytes: 1024,
      text: 'hello'
    });
    const res = await POST(mockEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Unsupported MIME type');
  });

  test('returns 201, uploads to R2, and inserts into DB on success', async () => {
    const res = await POST(mockEvent);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.filename).toBe('test.txt');
    expect(body.status).toBe('pending');
    expect(body.id).toBeDefined();

    // Verify R2 put was called
    expect(mockBucket.put).toHaveBeenCalledTimes(1);
    const expectedR2Key = `documents/user-123/${body.id}.txt`;
    expect(mockBucket.put).toHaveBeenCalledWith(
      expectedR2Key,
      'hello world',
      { httpMetadata: { contentType: 'text/plain' } }
    );

    // Verify DB insert was called
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: body.id,
        userId: 'user-123',
        filename: 'test.txt',
        mimeType: 'text/plain',
        sizeBytes: 1024,
        r2Key: expectedR2Key,
        status: 'pending'
      })
    );
  });

  test('deletes R2 object if DB insertion fails', async () => {
    mockValues.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await POST(mockEvent);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Failed to record document metadata');

    // Verify R2 was put, then deleted
    expect(mockBucket.put).toHaveBeenCalledTimes(1);
    expect(mockBucket.delete).toHaveBeenCalledTimes(1);
  });
});
