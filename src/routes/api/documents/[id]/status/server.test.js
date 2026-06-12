// @vitest-environment node
import { describe, expect, test, vi, beforeEach } from 'vitest';

const { mockSelect, mockFrom, mockWhere, mockLimit } = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  return { mockSelect, mockFrom, mockWhere, mockLimit };
});

vi.mock('$lib/server/db.js', () => {
  return {
    getDb: vi.fn().mockReturnValue({
      select: mockSelect
    })
  };
});

import { GET } from './+server.js';

describe('GET /api/documents/[id]/status', () => {
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
        }
      }
    };
  });

  test('returns 401 if user is not authenticated', async () => {
    mockEvent.locals.user = null;
    const res = await GET(mockEvent);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('returns 404 if document is not found or not owned', async () => {
    mockLimit.mockResolvedValue([]);
    const res = await GET(mockEvent);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('Document not found');
  });

  test('returns 200 and document status on success', async () => {
    mockLimit.mockResolvedValue([{ id: 'doc-123', status: 'ready' }]);
    const res = await GET(mockEvent);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('doc-123');
    expect(body.status).toBe('ready');
  });
});
