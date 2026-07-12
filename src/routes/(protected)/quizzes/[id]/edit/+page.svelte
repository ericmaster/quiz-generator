<script>
  let { data } = $props();

  // Reactive local states
  let questions = $state(data.questions || []);
  let savedOrderIds = $state(data.questions.map(q => q.id));

  let title = $state(data.quiz.title || '');
  let originalTitle = $state(data.quiz.title || '');
  let isTitleSaving = $state(false);
  let titleError = $state('');

  let editingQuestionId = $state(null);
  let editForm = $state({
    questionText: '',
    options: ['', '', '', ''],
    answer: '',
    explanation: ''
  });

  const hasTitleChanged = $derived(title.trim() !== originalTitle && title.trim() !== '');
  const hasOrderChanged = $derived(
    JSON.stringify(questions.map(q => q.id)) !== JSON.stringify(savedOrderIds)
  );

  async function handleSaveTitle() {
    if (!title.trim()) {
      titleError = 'Title cannot be empty';
      return;
    }

    try {
      isTitleSaving = true;
      titleError = '';
      const res = await fetch(`/api/quiz/${data.quiz.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update title');
      }

      originalTitle = title.trim();
    } catch (err) {
      console.error(err);
      titleError = err.message || 'Failed to update title';
    } finally {
      isTitleSaving = false;
    }
  }

  function startEditing(q) {
    editingQuestionId = q.id;
    editForm = {
      questionText: q.questionText,
      options: [...q.options],
      answer: q.answer,
      explanation: q.explanation || ''
    };
  }

  function cancelEditing() {
    editingQuestionId = null;
  }

  async function saveQuestion(qid) {
    const trimmedOpts = editForm.options.map(o => o.trim());
    if (trimmedOpts.some(o => !o)) {
      alert('All options must be filled out.');
      return;
    }
    if (new Set(trimmedOpts).size !== 4) {
      alert('All options must be unique.');
      return;
    }
    if (!trimmedOpts.includes(editForm.answer.trim())) {
      alert('Correct answer must match one of the options.');
      return;
    }

    try {
      const res = await fetch(`/api/quiz/${data.quiz.id}/questions/${qid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: editForm.questionText.trim(),
          options: trimmedOpts,
          answer: editForm.answer.trim(),
          explanation: editForm.explanation.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update question');
      }

      const updated = await res.json();
      questions = questions.map(q => q.id === qid ? { ...q, ...updated } : q);
      editingQuestionId = null;
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteQuestion(qid) {
    if (!confirm('Are you sure you want to delete this question?')) {
      return;
    }

    try {
      const res = await fetch(`/api/quiz/${data.quiz.id}/questions/${qid}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete question');
      }

      questions = questions.filter(q => q.id !== qid).map((q, idx) => ({ ...q, position: idx }));
      savedOrderIds = savedOrderIds.filter(id => id !== qid);
    } catch (err) {
      alert(err.message);
    }
  }

  function moveQuestion(index, direction) {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    questions = updated.map((q, idx) => ({ ...q, position: idx }));
  }

  let isSavingOrder = $state(false);

  async function saveOrder() {
    try {
      isSavingOrder = true;
      const res = await fetch(`/api/quiz/${data.quiz.id}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: questions.map(q => q.id)
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save order');
      }

      savedOrderIds = questions.map(q => q.id);
    } catch (err) {
      alert(err.message);
    } finally {
      isSavingOrder = false;
    }
  }
</script>

<svelte:head>
  <title>Edit {originalTitle} - QuizGenerator</title>
</svelte:head>

<main class="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 transition-colors duration-300">
  <div class="max-w-4xl mx-auto">
    <!-- Top Nav links -->
    <div class="flex justify-between items-center mb-6">
      <a
        href="/quizzes/{data.quiz.id}"
        class="text-sm font-semibold text-slate-650 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 active:scale-95 transition"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Quiz Taking
      </a>

      <a
        href="/api/quiz/{data.quiz.id}/export"
        download="quiz-{originalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json"
        class="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 text-indigo-650 dark:text-indigo-400 font-bold px-4 py-2 rounded-xl text-sm transition active:scale-95 flex items-center gap-1.5"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export Quiz
      </a>
    </div>

    <!-- Editable Title Header -->
    <div class="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs mb-8">
      <h2 class="text-sm font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider mb-2">Quiz Title</h2>
      <div class="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          bind:value={title}
          placeholder="Enter quiz title..."
          class="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 font-semibold"
        />
        <button
          onclick={handleSaveTitle}
          disabled={!hasTitleChanged || isTitleSaving}
          class="bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-bold px-6 py-3 rounded-xl transition active:scale-95 text-sm"
        >
          {isTitleSaving ? 'Saving...' : 'Save Title'}
        </button>
      </div>
      {#if titleError}
        <p class="text-rose-500 text-xs font-semibold mt-2">{titleError}</p>
      {/if}
    </div>

    <!-- Save Order floating bar -->
    {#if hasOrderChanged}
      <div class="bg-indigo-600 text-white px-6 py-4 rounded-2xl shadow-lg flex items-center justify-between mb-8 animate-fade-in">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span class="font-bold text-sm">You have unsaved order changes!</span>
        </div>
        <button
          onclick={saveOrder}
          disabled={isSavingOrder}
          class="bg-white text-indigo-650 hover:bg-indigo-50 font-extrabold px-5 py-2 rounded-xl text-sm transition active:scale-95 shadow-sm"
        >
          {isSavingOrder ? 'Saving...' : 'Save Order Now'}
        </button>
      </div>
    {/if}

    <!-- Questions list -->
    <div class="space-y-6">
      {#each questions as q, index (q.id)}
        <div class="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs transition duration-300">
          
          {#if editingQuestionId === q.id}
            <!-- Inline Edit Form -->
            <div class="space-y-4">
              <div class="flex justify-between items-center">
                <span class="font-bold text-indigo-600 dark:text-indigo-400">Editing Question {index + 1}</span>
                <button
                  onclick={cancelEditing}
                  class="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Question Text</label>
                <textarea
                  bind:value={editForm.questionText}
                  rows="2"
                  class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
                ></textarea>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {#each [0, 1, 2, 3] as optIndex}
                  <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Option {optIndex + 1}</label>
                    <input
                      type="text"
                      bind:value={editForm.options[optIndex]}
                      class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
                    />
                  </div>
                {/each}
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Correct Answer</label>
                  <select
                    bind:value={editForm.answer}
                    class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 text-sm font-semibold capitalize"
                  >
                    {#each editForm.options as option}
                      {#if option.trim()}
                        <option value={option.trim()}>{option.trim()}</option>
                      {/if}
                    {/each}
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Explanation</label>
                  <textarea
                    bind:value={editForm.explanation}
                    rows="2"
                    class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 text-sm font-semibold"
                  ></textarea>
                </div>
              </div>

              <div class="flex justify-end gap-2 pt-2">
                <button
                  onclick={cancelEditing}
                  class="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-bold px-4 py-2 rounded-xl text-sm transition"
                >
                  Cancel
                </button>
                <button
                  onclick={() => saveQuestion(q.id)}
                  class="bg-indigo-600 hover:bg-indigo-550 text-white font-bold px-5 py-2 rounded-xl text-sm transition shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </div>
          {:else}
            <!-- Question Display Mode -->
            <div class="flex justify-between items-start gap-4 mb-4">
              <div class="flex items-start gap-3">
                <span class="inline-flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/50 text-indigo-650 dark:text-indigo-400 font-extrabold w-8 h-8 rounded-lg text-sm shrink-0">
                  {index + 1}
                </span>
                <h3 class="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                  {q.questionText}
                </h3>
              </div>
              
              <!-- Reordering buttons -->
              <div class="flex items-center gap-1 shrink-0 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-100 dark:border-slate-850">
                <button
                  onclick={() => moveQuestion(index, 'up')}
                  disabled={index === 0}
                  class="p-1 rounded-sm hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-500"
                  title="Move Up"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onclick={() => moveQuestion(index, 'down')}
                  disabled={index === questions.length - 1}
                  class="p-1 rounded-sm hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-slate-500"
                  title="Move Down"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Options -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pl-11 mb-4">
              {#each q.options as option}
                <div
                  class="flex items-center gap-3 p-3.5 rounded-xl border text-sm font-medium
                    {q.answer === option
                      ? 'border-emerald-500 bg-emerald-50/35 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 font-bold'
                      : 'border-slate-200 dark:border-slate-850 bg-slate-50/20 dark:bg-slate-900/20 text-slate-700 dark:text-slate-300'}"
                >
                  {#if q.answer === option}
                    <svg class="w-4 h-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3.5" d="M5 13l4 4L19 7" />
                    </svg>
                  {:else}
                    <div class="w-4 h-4 shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-700"></div>
                  {/if}
                  <span>{option}</span>
                </div>
              {/each}
            </div>

            {#if q.explanation}
              <div class="ml-11 mb-4 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-850">
                <span class="font-bold text-slate-700 dark:text-slate-300">Explanation:</span> {q.explanation}
              </div>
            {/if}

            <!-- Action buttons -->
            <div class="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-850">
              <button
                onclick={() => startEditing(q)}
                class="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-xl text-xs transition"
              >
                Edit
              </button>
              <button
                onclick={() => deleteQuestion(q.id)}
                class="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-400 font-bold px-4 py-2 rounded-xl text-xs transition"
              >
                Delete
              </button>
            </div>
          {/if}

        </div>
      {/each}
    </div>
  </div>
</main>
