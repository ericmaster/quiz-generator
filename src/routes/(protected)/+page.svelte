<script>
  import { onMount } from 'svelte';
  import Questions from '$lib/components/Questions.svelte';
  import Result from '$lib/components/Result.svelte';
  import { shuffleArray } from '$lib/utils.js';

  /**
   * @typedef {Object} Question
   * @property {string} question
   * @property {string[]} options
   * @property {string} answer
   * @property {string} explanation
   */

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

  let quizName = $state('Sample Machine Learning');
  /** @type {Question[]} */
  let questions = $state([]);
  /** @type {string[]} */
  let userAnswers = $state([]);
  /** @type {QuizResult | null} */
  let result = $state(null);
  let isSubmitted = $state(false);
  let isLoading = $state(true);
  let errorMsg = $state('');

  async function loadQuiz() {
    try {
      isLoading = true;
      errorMsg = '';
      const response = await fetch('/data/mcqs_sample.json');
      if (!response.ok) {
        throw new Error(`Failed to load quiz data: ${response.statusText}`);
      }
      /** @type {Question[]} */
      const allQuestions = await response.json();
      questions = shuffleArray(allQuestions).slice(0, 20);
      userAnswers = new Array(questions.length).fill('');
      result = null;
      isSubmitted = false;
    } catch (e) {
      console.error(e);
      errorMsg = 'Could not load quiz questions. Please make sure the sample file is available.';
    } finally {
      isLoading = false;
    }
  }

  function submitQuiz() {
    let score = 0;
    /** @type {DetailedResult[]} */
    const detailedResults = [];

    questions.forEach((q, i) => {
      const isCorrect = userAnswers[i] === q.answer;
      if (isCorrect) {
        score++;
      } else {
        detailedResults.push({
          question: q.question,
          userAnswer: userAnswers[i] || 'No answer selected',
          correctAnswer: q.answer,
          explanation: q.explanation || 'No explanation provided.',
          isCorrect,
        });
      }
    });

    result = { score, total: questions.length, detailedResults };
    isSubmitted = true;

    // Smooth scroll to results
    setTimeout(() => {
      const resultEl = document.getElementById('results-section');
      if (resultEl) {
        resultEl.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }

  onMount(() => {
    loadQuiz();
  });
</script>

<svelte:head>
  <title>{quizName} Quiz</title>
</svelte:head>

<main class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
  <div class="max-w-4xl mx-auto">
    <!-- Header banner -->
    <header class="text-center mb-12">
      <h1 class="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent sm:text-5xl mb-3">
        {quizName} Quiz
      </h1>
      <p class="text-slate-600 dark:text-slate-400 text-lg font-medium">
        Test your knowledge on the key concepts.
      </p>
    </header>

    {#if isLoading}
      <!-- Loading state -->
      <div class="flex flex-col items-center justify-center py-20 space-y-4">
        <div class="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-slate-500 dark:text-slate-400 font-semibold">Loading questions...</p>
      </div>
    {:else if errorMsg}
      <!-- Error state -->
      <div class="bg-rose-50 dark:bg-rose-950/20 border-2 border-rose-200 dark:border-rose-900/50 p-6 rounded-2xl text-center">
        <p class="text-rose-700 dark:text-rose-400 font-bold mb-4">{errorMsg}</p>
        <button
          onclick={loadQuiz}
          class="bg-rose-600 text-white font-semibold px-6 py-2 rounded-xl shadow-sm hover:bg-rose-700 active:scale-95 transition"
        >
          Try Again
        </button>
      </div>
    {:else}
      <!-- Quiz panel -->
      <div class="space-y-8">
        <div class="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <span class="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Total Questions: <strong class="text-slate-800 dark:text-slate-200">{questions.length}</strong>
          </span>
          <button
            onclick={loadQuiz}
            class="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-1.5 active:scale-95 transition"
          >
            <!-- Refresh SVG -->
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3m0 0l3-3m-3 3V8"></path>
            </svg>
            Reset Quiz
          </button>
        </div>

        <!-- Questions List -->
        <Questions {questions} bind:userAnswers />

        <!-- Submit Panel -->
        {#if !isSubmitted}
          <div class="flex justify-center py-6">
            <button
              onclick={submitQuiz}
              class="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-12 py-4 rounded-2xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all duration-200 text-lg"
            >
              Submit Quiz
            </button>
          </div>
        {/if}

        <!-- Results Section -->
        {#if result}
          <div id="results-section" class="pt-8 border-t border-slate-200 dark:border-slate-800">
            <Result {result} />
            
            <div class="flex justify-center mt-8">
              <button
                onclick={loadQuiz}
                class="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold px-8 py-3.5 rounded-xl shadow-sm active:scale-95 transition"
              >
                Retake Quiz
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</main>
