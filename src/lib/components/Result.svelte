<script>
  /**
   * @typedef {Object} DetailedResult
   * @property {string} question
   * @property {string} userAnswer
   * @property {string} correctAnswer
   * @property {string} explanation
   * @property {boolean} isCorrect
   */

  /**
   * @typedef {Object} QuizResult
   * @property {number} score
   * @property {number} total
   * @property {DetailedResult[]} detailedResults
   */

  /** @type {QuizResult} */
  export let result;

  $: percentage = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
</script>

<div class="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800 transition-all duration-300">
  <div class="text-center mb-8">
    <h2 class="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Quiz Completed!</h2>
    <div class="inline-flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 rounded-full w-32 h-32 border-4 border-indigo-500/30 mb-4">
      <span class="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">{result.score}</span>
      <span class="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">out of {result.total}</span>
    </div>
    <p class="text-lg font-medium text-slate-600 dark:text-slate-300">
      Score: <span class="text-indigo-600 dark:text-indigo-400 font-bold">{percentage}%</span>
    </p>
  </div>

  {#if result.detailedResults && result.detailedResults.length > 0}
    <h3 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 border-b pb-2 border-slate-100 dark:border-slate-800">
      Review Incorrect Answers
    </h3>
    <div class="space-y-6">
      {#each result.detailedResults as res, i}
        <div class="p-5 bg-rose-50/30 dark:bg-rose-950/10 rounded-2xl border border-rose-100 dark:border-rose-950/30">
          <p class="font-semibold text-slate-800 dark:text-slate-100 mb-3">
            Q: {res.question}
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-3">
            <div class="p-3 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl">
              <span class="block text-xs font-semibold text-rose-500 dark:text-rose-400 uppercase tracking-wider mb-1">Your Answer</span>
              <span class="font-medium text-rose-700 dark:text-rose-300">{res.userAnswer}</span>
            </div>
            <div class="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl">
              <span class="block text-xs font-semibold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider mb-1">Correct Answer</span>
              <span class="font-medium text-emerald-700 dark:text-emerald-300">{res.correctAnswer}</span>
            </div>
          </div>
          {#if res.explanation}
            <div class="mt-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
              <span class="font-semibold text-slate-700 dark:text-slate-300">Explanation:</span> {res.explanation}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="text-center p-6 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100 dark:border-emerald-950/30 mt-6">
      <p class="text-emerald-700 dark:text-emerald-400 font-bold text-lg">Perfect Score! 🎉</p>
      <p class="text-sm text-emerald-600 dark:text-emerald-500 mt-1">Excellent job, you answered all questions correctly!</p>
    </div>
  {/if}
</div>
