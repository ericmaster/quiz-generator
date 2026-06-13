<script>
  let { data } = $props();

  // Reactive state for the local list of quizzes
  let quizzes = $state(data.quizzes || []);
  let errorMsg = $state('');
  let isDeleting = $state({});

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this quiz?')) {
      return;
    }

    try {
      isDeleting[id] = true;
      const res = await fetch(`/api/quiz/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete quiz');
      }

      quizzes = quizzes.filter(q => q.id !== id);
    } catch (err) {
      console.error(err);
      errorMsg = err.message || 'Failed to delete quiz';
    } finally {
      isDeleting[id] = false;
    }
  }
</script>

<svelte:head>
  <title>Saved Quizzes - QuizGenerator</title>
</svelte:head>

<main class="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 transition-colors duration-300">
  <div class="max-w-4xl mx-auto">
    <header class="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl text-slate-900 dark:text-white">
          Saved Quizzes
        </h1>
        <p class="text-slate-500 dark:text-slate-400 mt-1">
          Review, edit, export, or retake your previously saved quizzes.
        </p>
      </div>
      <a
        href="/"
        class="bg-indigo-600 hover:bg-indigo-550 text-white font-bold px-6 py-3 rounded-xl shadow-md active:scale-95 transition text-sm flex items-center gap-1.5"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
        </svg>
        Generate New Quiz
      </a>
    </header>

    {#if errorMsg}
      <div class="bg-rose-50 dark:bg-rose-950/20 border-2 border-rose-200 dark:border-rose-900/40 p-4 rounded-xl text-rose-800 dark:text-rose-450 font-semibold mb-6 flex items-center gap-2">
        <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        {errorMsg}
      </div>
    {/if}

    {#if quizzes.length === 0}
      <div class="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-3xl p-10 text-center shadow-sm">
        <div class="inline-flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-600 w-16 h-16 rounded-full mb-4">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h3 class="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">No Saved Quizzes</h3>
        <p class="text-slate-500 dark:text-slate-450 max-w-md mx-auto mb-6">
          You haven't saved any quizzes yet. Generate a quiz and save it to see it here.
        </p>
        <a
          href="/"
          class="inline-flex items-center gap-1.5 text-indigo-650 dark:text-indigo-400 font-semibold hover:underline"
        >
          Go generate a quiz
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>
      </div>
    {:else}
      <div class="grid gap-6">
        {#each quizzes as q (q.id)}
          <div class="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition hover:shadow-md duration-200">
            <div class="space-y-2">
              <div class="flex items-center flex-wrap gap-2">
                <h3 class="text-xl font-bold text-slate-900 dark:text-white">{q.title}</h3>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold capitalize
                  {q.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : ''}
                  {q.difficulty === 'medium' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-450' : ''}
                  {q.difficulty === 'hard' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-450' : ''}"
                >
                  {q.difficulty}
                </span>
              </div>
              <div class="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                <span class="flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  {q.questionCount} {q.questionCount === 1 ? 'Question' : 'Questions'}
                </span>
                <span>&bull;</span>
                <span>
                  Saved on {new Date(q.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </span>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <a
                href="/quizzes/{q.id}"
                class="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 text-indigo-650 dark:text-indigo-400 font-bold px-4 py-2.5 rounded-xl text-sm transition active:scale-95"
              >
                Take Quiz
              </a>
              <a
                href="/quizzes/{q.id}/edit"
                class="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-4 py-2.5 rounded-xl text-sm transition active:scale-95"
              >
                Edit
              </a>
              <a
                href="/api/quiz/{q.id}/export"
                download="quiz-{q.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json"
                class="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-4 py-2.5 rounded-xl text-sm transition active:scale-95 flex items-center gap-1"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </a>
              <button
                onclick={() => handleDelete(q.id)}
                disabled={isDeleting[q.id]}
                class="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-450 font-bold px-4 py-2.5 rounded-xl text-sm transition active:scale-95 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</main>
