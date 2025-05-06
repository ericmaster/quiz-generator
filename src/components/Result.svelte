<script>
  export let result;
</script>

<div class="bg-white p-6 rounded-lg shadow-md">
  <h2 class="text-2xl font-bold mb-4">Your Results</h2>
  <p class="mb-4">Score: {result.score}/{result.total}</p>

  {#each result.detailedResults as res, i}
    <div class="mb-4">
      <p class="font-semibold">Q{i + 1}: {res.question}</p>
      <p>
        Your Answer: <span class="text-red-600">{res.userAnswer}</span>
      </p>
      <p>
        Correct Answer: <span class="text-green-600">{res.correctAnswer}</span>
      </p>
      <p class="text-sm text-gray-600">Explanation: {res.explanation}</p>
    </div>
  {/each}
</div>

<style>
  .mb-4 {
    margin-bottom: 1rem;
  }
</style>