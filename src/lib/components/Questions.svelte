<script>
  import { shuffleArray } from '$lib/utils.js';

  /**
   * @typedef {Object} Question
   * @property {string} question
   * @property {string[]} options
   * @property {string} answer
   * @property {string} explanation
   */

  /** @type {Question[]} */
  export let questions = [];
  /** @type {string[]} */
  export let userAnswers = [];

  // Shuffle options once per question so they don't re-shuffle on re-render.
  /** @type {string[][]} */
  let shuffledOptions = [];
  $: {
    if (questions && questions.length > 0) {
      shuffledOptions = questions.map(q => shuffleArray([...q.options]));
    }
  }
</script>

<div class="space-y-6">
  {#each questions as question, i}
    <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800 transition-all duration-300">
      <div class="flex items-start gap-4 mb-4">
        <span class="inline-flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold w-8 h-8 rounded-lg text-sm shrink-0">
          {i + 1}
        </span>
        <p class="text-lg font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
          {question.question}
        </p>
      </div>

      <div class="grid grid-cols-1 gap-3 md:pl-12">
        {#each shuffledOptions[i] || [] as option}
          <label class="flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer
            {userAnswers[i] === option 
              ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-500/30' 
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/30 dark:bg-slate-900/30'}"
          >
            <input 
              type="radio" 
              bind:group={userAnswers[i]} 
              value={option} 
              class="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" 
            />
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">
              {option}
            </span>
          </label>
        {/each}
      </div>
    </div>
  {/each}
</div>
