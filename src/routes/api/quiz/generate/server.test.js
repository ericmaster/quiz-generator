// @vitest-environment node
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { POST } from './+server.js';

const mockGenerateQuiz = vi.fn();

vi.mock('$lib/server/quiz.js', () => {
  return {
    generateQuiz: (...args) => mockGenerateQuiz(...args)
  };
});

describe('POST /api/quiz/generate', () => {
  let mockEvent;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEvent = {
      locals: {
        user: { id: 'user-123' }
      },
      request: {
        json: vi.fn().mockResolvedValue({
          topicIds: ['topic-1', 'topic-2'],
          difficulty: 'medium',
          count: 5
        })
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
    const res = await POST(mockEvent);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('returns 500 if platform bindings are missing', async () => {
    mockEvent.platform = null;
    const res = await POST(mockEvent);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Platform bindings are not available');
  });

  test('returns 400 on invalid JSON body', async () => {
    mockEvent.request.json.mockRejectedValue(new Error('JSON parse error'));
    const res = await POST(mockEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid JSON');
  });

  test('returns 400 on missing or empty topicIds', async () => {
    // Missing topicIds
    mockEvent.request.json.mockResolvedValue({
      difficulty: 'medium',
      count: 5
    });
    let res = await POST(mockEvent);
    expect(res.status).toBe(400);

    // Empty topicIds array
    mockEvent.request.json.mockResolvedValue({
      topicIds: [],
      difficulty: 'medium',
      count: 5
    });
    res = await POST(mockEvent);
    expect(res.status).toBe(400);
  });

  test('returns 400 on invalid difficulty', async () => {
    mockEvent.request.json.mockResolvedValue({
      topicIds: ['topic-1'],
      difficulty: 'super-hard',
      count: 5
    });
    const res = await POST(mockEvent);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('difficulty must be easy, medium, or hard');
  });

  test('returns 400 on invalid count', async () => {
    // Count too small
    mockEvent.request.json.mockResolvedValue({
      topicIds: ['topic-1'],
      difficulty: 'easy',
      count: 0
    });
    let res = await POST(mockEvent);
    expect(res.status).toBe(400);

    // Count too large
    mockEvent.request.json.mockResolvedValue({
      topicIds: ['topic-1'],
      difficulty: 'easy',
      count: 21
    });
    res = await POST(mockEvent);
    expect(res.status).toBe(400);
  });

  test('returns 200 and calls generateQuiz on success', async () => {
    const mockOutput = {
      questions: [
        {
          question: 'Q1',
          options: ['A', 'B', 'C', 'D'],
          answer: 'A',
          explanation: 'E'
        }
      ],
      topicNames: ['Topic 1'],
      difficulty: 'medium',
      requestedCount: 5,
      generatedCount: 1,
      sourceDocumentIds: ['doc-1']
    };
    mockGenerateQuiz.mockResolvedValue(mockOutput);

    const res = await POST(mockEvent);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toEqual(mockOutput);
    expect(mockGenerateQuiz).toHaveBeenCalledWith(mockEvent.platform.env, {
      userId: 'user-123',
      topicIds: ['topic-1', 'topic-2'],
      difficulty: 'medium',
      count: 5
    });
  });
});
