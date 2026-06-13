import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { expect, test, vi, beforeEach } from 'vitest';
import Page from './+page.svelte';

beforeEach(() => {
  vi.clearAllMocks();

  // Mock global scrollIntoView on HTMLElement
  if (typeof window !== 'undefined') {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.scrollTo = vi.fn();
  }
});

test('quiz generation and taking flow', async () => {
  // 1. Mock the API call for generating a quiz
  const mockQuizResponse = {
    questions: [
      {
        question: 'What is Svelte 5?',
        options: ['Compiler', 'Runtime library', 'Operating System', 'Database'],
        answer: 'Compiler',
        explanation: 'Svelte 5 is a modern compiler.'
      }
    ],
    topicNames: ['SvelteKit'],
    difficulty: 'medium',
    requestedCount: 1,
    generatedCount: 1
  };

  globalThis.fetch = vi.fn().mockImplementation((url, init) => {
    if (url === '/api/quiz/generate') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockQuizResponse)
      });
    }
    return Promise.resolve({
      ok: false,
      status: 404
    });
  });

  // 2. Render Page with sample topics data
  const dataProp = {
    topics: [
      { id: 'topic-svelte', name: 'SvelteKit' },
      { id: 'topic-d1', name: 'D1 Database' }
    ]
  };

  render(Page, { props: { data: dataProp } });

  // 3. Verify page header and topic chips are rendered
  expect(screen.queryByText('Practice Quiz')).toBeNull(); // Not in quiz stage yet
  expect(screen.queryByText('SvelteKit')).not.toBeNull();
  expect(screen.queryByText('D1 Database')).not.toBeNull();

  // 4. Try to click Generate Quiz without choosing topics - should show validation error or not trigger
  const generateBtn = screen.queryByText('Generate Quiz');
  expect(generateBtn).not.toBeNull();
  await fireEvent.click(generateBtn);

  // 5. Select 'SvelteKit' topic
  const svelteTopicChip = screen.queryByText('SvelteKit');
  await fireEvent.click(svelteTopicChip);

  // 6. Click Generate Quiz
  await fireEvent.click(generateBtn);

  // 7. Verify loading state is shown and then questions are rendered
  await waitFor(() => {
    expect(screen.queryByText(/Total Questions:/i)).not.toBeNull();
  });

  // Check question content is present
  expect(screen.queryByText(/What is Svelte 5\?/i)).not.toBeNull();

  // 8. Select the correct option
  const correctOptionLabel = screen.queryByText('Compiler');
  expect(correctOptionLabel).not.toBeNull();
  await fireEvent.click(correctOptionLabel);

  // 9. Click Submit Quiz
  const submitBtn = screen.queryByText('Submit Quiz');
  expect(submitBtn).not.toBeNull();
  await fireEvent.click(submitBtn);

  // 10. Verify results
  await waitFor(() => {
    expect(screen.queryByText(/Quiz Completed!/i)).not.toBeNull();
    expect(screen.queryByText(/Perfect Score!/i)).not.toBeNull();
  });
});
