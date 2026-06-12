import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import Questions from './Questions.svelte';

test('renders questions and options', () => {
  const questions = [
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
  ];
  const userAnswers = [];

  render(Questions, { props: { questions, userAnswers } });

  // Verify the question is rendered
  const questionEl = screen.queryByText(/What is the output of ML concept 1\?/i);
  expect(questionEl).not.toBeNull();

  // Verify options are rendered
  expect(screen.queryByText(/Correct Answer 1/i)).not.toBeNull();
  expect(screen.queryByText(/Wrong Answer A1/i)).not.toBeNull();
});
