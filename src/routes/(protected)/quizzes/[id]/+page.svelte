<script>
  import Questions from '$lib/components/Questions.svelte';
  import Result from '$lib/components/Result.svelte';

  let { data } = $props();
  
  function getAnswers() {
    return new Array(data.questions.length).fill('');
  }
  let userAnswers = $state(getAnswers());
  let isSubmitted = $state(false);
  let result = $state(null);

  const mappedQuestions = $derived(
    data.questions.map(q => ({
      question: q.questionText,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation
    }))
  );

  function submitQuiz() {
    let score = 0;
    const detailedResults = [];

    data.questions.forEach((q, i) => {
      const isCorrect = userAnswers[i] === q.answer;
      if (isCorrect) {
        score++;
      } else {
        detailedResults.push({
          question: q.questionText,
          userAnswer: userAnswers[i] || 'No answer selected',
          correctAnswer: q.answer,
          explanation: q.explanation || 'No explanation provided.',
          isCorrect,
        });
      }
    });

    result = { score, total: data.questions.length, detailedResults };
    isSubmitted = true;

    // Smooth scroll to results
    setTimeout(() => {
      const resultEl = document.getElementById('results-section');
      if (resultEl && typeof resultEl.scrollIntoView === 'function') {
        resultEl.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }

  function retakeQuiz() {
    userAnswers = new Array(data.questions.length).fill('');
    result = null;
    isSubmitted = false;
    
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  }
</script>

<svelte:head>
  <title>{data.quiz.title} - QuizGenerator</title>
</svelte:head>

<main class="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 transition-colors duration-300">
  <div class="max-w-4xl mx-auto">
    <header class="text-center mb-10">
      <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl mb-2 text-slate-900 dark:text-white">
        {data.quiz.title}
      </h1>
      <p class="text-slate-500 dark:text-slate-400 font-medium">
        Difficulty: <strong class="text-indigo-650 dark:text-indigo-400 capitalize">{data.quiz.difficulty}</strong> &bull;
        Questions: <strong class="text-slate-800 dark:text-slate-200">{data.questions.length}</strong>
      </p>
    </header>

    <div class="space-y-8">
      <div class="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <a
          href="/quizzes"
          class="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 active:scale-95 transition"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Saved Quizzes
        </a>
        
        <a
          href="/quizzes/{data.quiz.id}/edit"
          class="text-sm font-semibold text-indigo-605 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-1.5 active:scale-95 transition"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Quiz
        </a>
      </div>

      <!-- Render Questions using the existing component -->
      <Questions questions={mappedQuestions} bind:userAnswers />

      {#if !isSubmitted}
        <div class="flex justify-center py-6">
          <button
            onclick={submitQuiz}
            class="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-650 hover:from-indigo-550 hover:to-purple-555 text-white font-bold px-12 py-4 rounded-2xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all duration-200 text-lg"
          >
            Submit Quiz
          </button>
        </div>
      {/if}

      <!-- Results section -->
      {#if result}
        <div id="results-section" class="pt-8 border-t border-slate-200 dark:border-slate-800">
          <Result {result} />
          
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <button
              onclick={retakeQuiz}
              class="w-full sm:w-auto bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold px-8 py-3.5 rounded-xl shadow-sm active:scale-95 transition"
            >
              Retake Quiz
            </button>
            <a
              href="/quizzes"
              class="w-full sm:w-auto text-center bg-indigo-600 hover:bg-indigo-550 text-white font-bold px-8 py-3.5 rounded-xl shadow-md active:scale-95 transition"
            >
              Back to Saved Quizzes
            </a>
          </div>
        </div>
      {/if}
    </div>
  </div>
</main>
