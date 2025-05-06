<script>
  import { onMount } from 'svelte';
  import { shuffleArray } from '../lib/utils.js';
  export let questions = [];
  export let userAnswers = [];

  function renderQuestions() {
    questions = shuffleArray(questions);
  }
</script>

<div>
  {#each questions as question, i}
    <div class="mb-4">
      <p><strong>Q{i + 1}:</strong> {question.question}</p>
      {#each shuffleArray([...question.options]) as option}
        <label>
          <input type="radio" bind:group={userAnswers[i]} value={option} /> {option}
        </label><br />
      {/each}
    </div>
  {/each}
</div>

<style>
  .mb-4 {
    margin-bottom: 1rem;
  }
</style>