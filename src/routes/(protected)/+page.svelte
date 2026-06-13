<script>
  import Questions from '$lib/components/Questions.svelte';
  import Result from '$lib/components/Result.svelte';

  let { data } = $props();
  
  // Quiz configuration state
  let selectedTopicIds = $state([]);
  let difficulty = $state('medium');
  let count = $state(5);
  
  // Generation & quiz execution state
  let questions = $state([]);
  /** @type {string[]} */
  let userAnswers = $state([]);
  let result = $state(null);
  let isSubmitted = $state(false);
  let isGenerating = $state(false);
  let errorMsg = $state('');
  let emptyStateMsg = $state('');
  let currentStage = $state('setup'); // 'setup' | 'quiz'

  // Toggle topic selection
  function toggleTopic(id) {
    if (selectedTopicIds.includes(id)) {
      selectedTopicIds = selectedTopicIds.filter(tid => tid !== id);
    } else {
      selectedTopicIds = [...selectedTopicIds, id];
    }
  }

  // Handle quiz generation
  async function generateNewQuiz() {
    if (selectedTopicIds.length === 0) {
      errorMsg = 'Please select at least one topic.';
      return;
    }

    try {
      isGenerating = true;
      errorMsg = '';
      emptyStateMsg = '';
      
      const response = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicIds: selectedTopicIds,
          difficulty,
          count
        })
      });

      if (!response.ok) {
        const errBody = await response.json();
        throw new Error(errBody.error || `Failed to generate quiz: ${response.statusText}`);
      }

      const body = await response.json();

      if (body.questions && body.questions.length > 0) {
        questions = body.questions;
        userAnswers = new Array(questions.length).fill('');
        result = null;
        isSubmitted = false;
        currentStage = 'quiz';
      } else {
        emptyStateMsg = body.reason || 'No usable content was found for the selected topics. Make sure your documents are fully processed.';
      }
    } catch (err) {
      console.error(err);
      errorMsg = err.message || 'An unexpected error occurred during quiz generation.';
    } finally {
      isGenerating = false;
    }
  }

  // Submit quiz answers
  function submitQuiz() {
    let score = 0;
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
      if (resultEl && typeof resultEl.scrollIntoView === 'function') {
        resultEl.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }

  function resetToSetup() {
    questions = [];
    userAnswers = [];
    result = null;
    isSubmitted = false;
    currentStage = 'setup';
  }

  function retakeQuiz() {
    userAnswers = new Array(questions.length).fill('');
    result = null;
    isSubmitted = false;
    
    // Smooth scroll to top of questions
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  }
</script>

<svelte:head>
  <title>Practice Quiz - QuizGenerator</title>
</svelte:head>

<main class="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 transition-colors duration-300">
  <div class="max-w-4xl mx-auto">
    {#if currentStage === 'setup' && !isGenerating}
      <!-- SETUP STAGE -->
      <header class="text-center mb-12">
        <h1 class="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent sm:text-5xl mb-3">
          Generate a Practice Quiz
        </h1>
        <p class="text-slate-600 dark:text-slate-400 text-lg font-medium">
          Select topics from your Knowledge Base and configure your quiz settings.
        </p>
      </header>

      <div class="space-y-8 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-3xl p-6 sm:p-10 shadow-sm transition duration-300">
        <!-- Error Alert -->
        {#if errorMsg}
          <div class="bg-rose-50 dark:bg-rose-950/20 border-2 border-rose-200 dark:border-rose-900/40 p-5 rounded-2xl flex items-start gap-3 text-rose-800 dark:text-rose-450">
            <svg class="w-6 h-6 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div class="font-semibold">{errorMsg}</div>
          </div>
        {/if}

        <!-- Empty Content Alert -->
        {#if emptyStateMsg}
          <div class="bg-amber-50 dark:bg-amber-955/10 border-2 border-amber-200 dark:border-amber-900/40 p-5 rounded-2xl flex items-start gap-3 text-amber-805 dark:text-amber-400">
            <svg class="w-6 h-6 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="font-semibold">{emptyStateMsg}</div>
          </div>
        {/if}

        <!-- 1. Topic Selection -->
        <div>
          <h3 class="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
            <span class="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-650 dark:text-indigo-400 flex items-center justify-center text-sm">1</span>
            Select Topics
          </h3>

          {#if !data.topics || data.topics.length === 0}
            <div class="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-8 rounded-2xl text-center">
              <p class="text-slate-500 dark:text-slate-400 font-medium mb-4">
                No topics with ready documents found.
              </p>
              <a
                href="/upload"
                class="inline-flex items-center gap-1.5 text-indigo-655 dark:text-indigo-400 font-semibold hover:underline"
              >
                Upload documents to get started
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          {:else}
            <div class="flex flex-wrap gap-3">
              {#each data.topics as topic (topic.id)}
                <button
                  type="button"
                  onclick={() => toggleTopic(topic.id)}
                  class="px-4 py-2.5 rounded-2xl font-semibold border-2 text-sm transition-all duration-200 active:scale-95 flex items-center gap-2
                    {selectedTopicIds.includes(topic.id)
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}"
                >
                  {#if selectedTopicIds.includes(topic.id)}
                    <!-- Check icon -->
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  {/if}
                  {topic.name}
                </button>
              {/each}
            </div>
            <div class="text-xs text-slate-400 mt-2 font-medium">
              Only topics extracted from fully processed ("ready") documents are listed.
            </div>
          {/if}
        </div>

        <!-- 2. Settings Grid -->
        <div class="grid md:grid-cols-2 gap-8 border-t border-slate-100 dark:border-slate-800 pt-8">
          <!-- Difficulty -->
          <div>
            <h3 class="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
              <span class="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-650 dark:text-indigo-400 flex items-center justify-center text-sm">2</span>
              Choose Difficulty
            </h3>
            <div class="flex gap-2">
              {#each ['easy', 'medium', 'hard'] as level}
                <button
                  type="button"
                  onclick={() => difficulty = level}
                  class="flex-1 py-3 rounded-2xl font-bold border-2 text-sm capitalize transition active:scale-95
                    {difficulty === level
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400'
                      : 'border-slate-200 dark:border-slate-750 bg-transparent text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'}"
                >
                  {level}
                </button>
              {/each}
            </div>
          </div>

          <!-- Question Count -->
          <div>
            <h3 class="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
              <span class="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-650 dark:text-indigo-400 flex items-center justify-center text-sm">3</span>
              Question Count
            </h3>
            <div class="flex gap-2">
              {#each [5, 10, 15, 20] as num}
                <button
                  type="button"
                  onclick={() => count = num}
                  class="flex-1 py-3 rounded-2xl font-bold border-2 text-sm transition active:scale-95
                    {count === num
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400'
                      : 'border-slate-200 dark:border-slate-750 bg-transparent text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'}"
                >
                  {num}
                </button>
              {/each}
            </div>
          </div>
        </div>

        <!-- 3. Submit action -->
        <div class="flex justify-center border-t border-slate-100 dark:border-slate-800 pt-8">
          <button
            type="button"
            onclick={generateNewQuiz}
            disabled={isGenerating || selectedTopicIds.length === 0}
            class="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-650 hover:from-indigo-550 hover:to-purple-550 text-white font-bold px-12 py-4 rounded-2xl shadow-lg shadow-indigo-550/20 active:scale-95 transition-all duration-200 text-lg disabled:opacity-50 disabled:pointer-events-none"
          >
            Generate Quiz
          </button>
        </div>
      </div>
    {:else if isGenerating}
      <!-- GENERATING STAGE -->
      <div class="flex flex-col items-center justify-center py-20 space-y-6">
        <div class="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <div class="text-center">
          <p class="text-xl font-bold mb-2">Generating Your Custom Quiz...</p>
          <p class="text-slate-500 dark:text-slate-450 font-medium max-w-sm">
            Retrieving documents from your Knowledge Base, parsing relevant chunks, and designing questions based on selected topics.
          </p>
        </div>
      </div>
    {:else if currentStage === 'quiz'}
      <!-- QUIZ EXECUTION STAGE -->
      <header class="text-center mb-10">
        <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl mb-2 text-slate-900 dark:text-white">
          Practice Quiz
        </h1>
        <p class="text-slate-500 dark:text-slate-400 font-medium">
          Level: <strong class="text-indigo-600 dark:text-indigo-400 capitalize">{difficulty}</strong> &bull;
          Topic count: <strong class="text-slate-800 dark:text-slate-200">{selectedTopicIds.length}</strong>
        </p>
      </header>

      <div class="space-y-8">
        <div class="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <span class="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Total Questions: <strong class="text-slate-850 dark:text-slate-200">{questions.length}</strong>
          </span>
          <button
            onclick={resetToSetup}
            class="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-1.5 active:scale-95 transition"
          >
            <!-- Back Arrow icon -->
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Choose Other Topics
          </button>
        </div>

        <!-- Questions list component -->
        <Questions {questions} bind:userAnswers />

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
              <button
                onclick={resetToSetup}
                class="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-550 text-white font-bold px-8 py-3.5 rounded-xl shadow-md active:scale-95 transition"
              >
                Configure New Quiz
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</main>
