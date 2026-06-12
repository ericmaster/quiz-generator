// @vitest-environment node
import { describe, expect, test, vi, beforeEach } from 'vitest';

const { mockSelect, mockFrom, mockWhere, mockLimit, mockUpdate, mockSet, mockUpdateWhere } = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

  const mockUpdateWhere = vi.fn().mockResolvedValue({});
  const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

  return { mockSelect, mockFrom, mockWhere, mockLimit, mockUpdate, mockSet, mockUpdateWhere };
});

vi.mock('$lib/server/db.js', () => {
  return {
    getDb: vi.fn().mockReturnValue({
      select: mockSelect,
      update: mockUpdate
    })
  };
});

// Mock processDocument
const { mockProcessDocument } = vi.hoisted(() => {
  return { mockProcessDocument: vi.fn().mockResolvedValue() };
});

vi.mock('$lib/server/ingest.js', () => {
  return {
    processDocument: mockProcessDocument
  };
});

import { POST } from './+server.js';

describe('POST /api/documents/[id]/retry', () => {
  let mockEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEvent = {
      locals: {
        user: { id: 'user-123' }
      },
      params: {
        id: 'doc-123'
      },
      platform: {
        env: {
          DB: {}
        },
        context: {
          waitUntil: vi.fn()
        }
      }
    };
  });

  test('returns 401 if user is not authenticated', async () => {
    mockEvent.locals.user = null;
    const res = await POST(mockEvent);
    expect(res.status).toBe(401);
  });

  test('returns 404 if document is not found or not owned', async () => {
    mockLimit.mockResolvedValue([]);
    const res = await POST(mockEvent);
    expect(res.status).toBe(404);
  });

  test('returns 400 if document status is not failed', async () => {
    mockLimit.mockResolvedValue([{ id: 'doc-123', status: 'ready', userId: 'user-123' }]);
    const res = await POST(mockEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Only documents with \'failed\' status can be retried');
  });

  test('updates status to processing and schedules ingestion on success', async () => {
    mockLimit.mockResolvedValue([{ id: 'doc-123', status: 'failed', userId: 'user-123' }]);
    const res = await POST(mockEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('doc-123');
    expect(body.status).toBe('processing');

    // Assert update to 'processing' was called
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith({ status: 'processing' });

    // Assert processDocument was scheduled via waitUntil
    expect(mockEvent.platform.context.waitUntil).toHaveBeenCalledTimes(1);
    expect(mockProcessDocument).toHaveBeenCalledWith(mockEvent.platform.env, 'doc-123');
  });
});
