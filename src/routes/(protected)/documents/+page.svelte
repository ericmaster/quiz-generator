<script>
  import { onMount, onDestroy } from 'svelte';

  let { data } = $props();
  
  let initialDocuments = data.documents || [];
  let documents = $state(initialDocuments);
  let activePollers = new Map(); // docId -> intervalId
  let isDeleting = $state(null); // docId being deleted
  let isRetrying = $state(null); // docId being retried

  function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  function formatDate(timestamp) {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async function pollStatus(id) {
    try {
      const res = await fetch(`/api/documents/${id}/status`);
      if (res.ok) {
        const body = await res.json();
        // Update document status in the state
        const index = documents.findIndex(d => d.id === id);
        if (index !== -1) {
          documents[index].status = body.status;
          
          // If terminal status is reached, stop polling
          if (body.status === 'ready' || body.status === 'failed') {
            stopPolling(id);
          }
        }
      } else {
        stopPolling(id);
      }
    } catch (err) {
      console.error(`Error polling status for doc ${id}:`, err);
      stopPolling(id);
    }
  }

  function startPolling(id) {
    if (activePollers.has(id)) return;
    const interval = setInterval(() => pollStatus(id), 2000);
    activePollers.set(id, interval);
  }

  function stopPolling(id) {
    if (activePollers.has(id)) {
      clearInterval(activePollers.get(id));
      activePollers.delete(id);
    }
  }

  // Handle retry
  async function handleRetry(id) {
    try {
      isRetrying = id;
      const res = await fetch(`/api/documents/${id}/retry`, { method: 'POST' });
      if (res.ok) {
        const index = documents.findIndex(d => d.id === id);
        if (index !== -1) {
          documents[index].status = 'processing';
          startPolling(id);
        }
      } else {
        alert('Failed to trigger retry.');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while retrying.');
    } finally {
      isRetrying = null;
    }
  }

  // Handle delete
  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this document? This will remove all associated chunks and topics, and clean up the vectorized data.')) {
      return;
    }

    try {
      isDeleting = id;
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        stopPolling(id);
        documents = documents.filter(d => d.id !== id);
      } else {
        const body = await res.json();
        alert(body.error || 'Failed to delete document.');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while deleting the document.');
    } finally {
      isDeleting = null;
    }
  }

  onMount(() => {
    // Start polling for any non-terminal documents
    documents.forEach(doc => {
      if (doc.status === 'pending' || doc.status === 'processing') {
        startPolling(doc.id);
      }
    });
  });

  onDestroy(() => {
    // Clean up all pollers
    activePollers.forEach(interval => clearInterval(interval));
    activePollers.clear();
  });
</script>

<svelte:head>
  <title>Manage Documents - QuizGenerator</title>
</svelte:head>

<main class="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 transition-colors duration-300">
  <div class="max-w-6xl mx-auto">
    <!-- Header banner -->
    <header class="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 via-purple-505 to-pink-500 bg-clip-text text-transparent sm:text-4xl mb-2">
          Knowledge Base Documents
        </h1>
        <p class="text-slate-500 dark:text-slate-400 font-medium">
          Manage your uploaded sources. Active processing happens in the background.
        </p>
      </div>
      <div>
        <a
          href="/upload"
          class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-550 text-white font-semibold px-6 py-3 rounded-2xl shadow-lg shadow-indigo-500/20 active:scale-95 transition"
        >
          <!-- Plus icon -->
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Upload Document
        </a>
      </div>
    </header>

    {#if documents.length === 0}
      <!-- Empty state -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-16 text-center shadow-sm">
        <div class="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-650 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 class="text-xl font-bold mb-2">No documents found</h3>
        <p class="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8 font-medium">
          Your Knowledge Base is empty. Upload documents like PDFs, text files, or markdown to start generating quizzes.
        </p>
        <a
          href="/upload"
          class="bg-indigo-600 hover:bg-indigo-550 text-white font-semibold px-6 py-3 rounded-xl shadow-md active:scale-95 transition"
        >
          Upload Your First File
        </a>
      </div>
    {:else}
      <!-- Document List Grid -->
      <div class="grid gap-6 md:grid-cols-1">
        {#each documents as doc (doc.id)}
          <div class="bg-white dark:bg-slate-900 border border-slate-250/50 dark:border-slate-800/80 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm hover:shadow-md transition duration-200">
            <div class="flex items-start gap-4 min-w-0">
              <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div class="min-w-0">
                <h3 class="text-lg font-bold truncate text-slate-900 dark:text-white" title={doc.filename}>
                  {doc.filename}
                </h3>
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-slate-500 dark:text-slate-400 font-medium">
                  <span>{formatBytes(doc.sizeBytes)}</span>
                  <span class="w-1 h-1 rounded-full bg-slate-350 dark:bg-slate-700 hidden sm:inline"></span>
                  <span>{formatDate(doc.createdAt)}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between md:justify-end gap-6 shrink-0">
              <!-- Status Pill -->
              <div class="flex items-center gap-2">
                {#if doc.status === 'ready'}
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Ready
                  </span>
                {:else if doc.status === 'processing'}
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/30">
                    <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                    Processing
                  </span>
                {:else if doc.status === 'failed'}
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/30">
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    Failed
                  </span>
                {:else}
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce"></span>
                    Pending
                  </span>
                {/if}
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2">
                {#if doc.status === 'failed'}
                  <button
                    onclick={() => handleRetry(doc.id)}
                    disabled={isRetrying === doc.id}
                    class="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-650 dark:text-indigo-400 hover:text-indigo-500 transition disabled:opacity-50 active:scale-95"
                    title="Retry Ingestion"
                  >
                    <!-- Retry icon -->
                    <svg class="w-5 h-5 {isRetrying === doc.id ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3m0 0l3-3m-3 3V8" />
                    </svg>
                  </button>
                {/if}

                <button
                  onclick={() => handleDelete(doc.id)}
                  disabled={isDeleting === doc.id}
                  class="p-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition disabled:opacity-50 active:scale-95"
                  title="Delete Document"
                >
                  <!-- Trash icon -->
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</main>
