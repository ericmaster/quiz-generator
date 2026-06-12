import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { expect, test, vi, beforeEach } from 'vitest';
import Page from './+page.svelte';

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([
      {
        question: 'What is the output of ML concept 1?',
        options: [
          'Correct Answer 1',
          'Wrong Answer A1',
          'Wrong Answer B1',
          'Wrong Answer C1'
        ],
        answer: 'Correct Answer 1',
        explanation: 'Explanation 1'
      }
    ])
  });
});

test('loads page, renders question, accepts answer, and submits successfully', async () => {
  render(Page);

  // 1. Wait for loading to finish and verify total questions
  await waitFor(() => {
    expect(screen.queryByText(/Total Questions:/i)).not.toBeNull();
  });

  // 2. Verify that the question is rendered
  expect(screen.queryByText(/What is the output of ML concept 1\?/i)).not.toBeNull();

  // 3. Select the correct option
  const correctOptionLabel = screen.queryByText('Correct Answer 1');
  expect(correctOptionLabel).not.toBeNull();
  await fireEvent.click(correctOptionLabel);

  // 4. Click Submit Quiz
  const submitBtn = screen.queryByText('Submit Quiz');
  expect(submitBtn).not.toBeNull();
  await fireEvent.click(submitBtn);

  // 5. Verify that perfect score result is displayed
  await waitFor(() => {
    expect(screen.queryByText(/Quiz Completed!/i)).not.toBeNull();
    expect(screen.queryByText(/Perfect Score!/i)).not.toBeNull();
  });
});
