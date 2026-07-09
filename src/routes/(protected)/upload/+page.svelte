<script>
  import { extractDocumentText, validateFile, MAX_DOCUMENT_BYTES } from '$lib/parse.js';

  let file = $state(null);
  let status = $state('idle'); // 'idle' | 'extracting' | 'uploading' | 'success' | 'error'
  let errorMessage = $state('');
  let uploadedDoc = $state(null); // { id, filename, status }
  let isDragOver = $state(false);

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function handleFileSelect(e) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    validateAndSetFile(selectedFile);
  }

  function validateAndSetFile(selectedFile) {
    errorMessage = '';
    uploadedDoc = null;
    status = 'idle';

    const { ok, reason } = validateFile(selectedFile);
    if (!ok) {
      if (reason === 'too_large') {
        errorMessage = `File is too large (${formatBytes(selectedFile.size)}). Maximum allowed size is 5MB.`;
      } else if (reason === 'unsupported') {
        errorMessage = 'Unsupported file format. Please upload a PDF, TXT, or MD file.';
      } else {
        errorMessage = 'No file selected.';
      }
      status = 'error';
      file = null;
      return;
    }

    file = selectedFile;
  }

  async function handleUpload() {
    if (!file) return;

    try {
      status = 'extracting';
      errorMessage = '';
      
      // 1. Client-side extraction
      const { text, mimeType } = await extractDocumentText(file);
      
      // Double check client-side text limit before posting
      const textBytes = new TextEncoder().encode(text).length;
      if (textBytes > MAX_DOCUMENT_BYTES) {
        throw new Error('Extracted text size exceeds the 5MB maximum limit. The document might have too much text content.');
      }

      status = 'uploading';

      // 2. Post to API
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          mimeType,
          sizeBytes: file.size,
          text
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${response.status}: ${response.statusText}`);
      }

      uploadedDoc = await response.json();
      status = 'success';
      file = null; // Reset file input
    } catch (err) {
      console.error(err);
      errorMessage = err.message || 'An unexpected error occurred during parsing or uploading.';
      status = 'error';
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave() {
    isDragOver = false;
  }

  function handleDrop(e) {
    e.preventDefault();
    isDragOver = false;
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  }
</script>

<svelte:head>
  <title>Upload Document - QuizGenerator</title>
</svelte:head>

<main class="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
  <div class="w-full max-w-xl">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-extrabold tracking-tight bg-linear-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent sm:text-4xl mb-3">
        Upload Document
      </h1>
      <p class="text-slate-600 dark:text-slate-400 text-sm font-medium">
        Upload PDF, TXT, or MD files up to 5MB. Text is parsed securely in your browser.
      </p>
    </div>

    <!-- Main Card Container -->
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden backdrop-blur-lg p-6 sm:p-8 relative transition-all duration-300">
      
      {#if status === 'success' && uploadedDoc}
        <!-- Success State -->
        <div class="flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div class="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center border border-emerald-200 dark:border-emerald-900/50 shadow-inner">
            <svg class="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          
          <div>
            <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">Upload Completed!</h2>
            <p class="text-slate-600 dark:text-slate-400 text-sm">
              Your document is stored and ready for processing.
            </p>
          </div>

          <div class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 text-left space-y-3 font-mono text-xs">
            <div class="flex justify-between border-b border-slate-200/40 dark:border-slate-800/40 pb-2">
              <span class="text-slate-500">ID:</span>
              <span class="text-slate-800 dark:text-slate-300 select-all font-semibold">{uploadedDoc.id}</span>
            </div>
            <div class="flex justify-between border-b border-slate-200/40 dark:border-slate-800/40 pb-2">
              <span class="text-slate-500">Filename:</span>
              <span class="text-slate-800 dark:text-slate-300 truncate max-w-[250px] font-semibold">{uploadedDoc.filename}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Status:</span>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 uppercase tracking-wide">
                {uploadedDoc.status}
              </span>
            </div>
          </div>

          <button
            onclick={() => { status = 'idle'; uploadedDoc = null; }}
            class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-indigo-500/20 active:scale-95 transition"
          >
            Upload Another Document
          </button>
        </div>
      {:else}
        <!-- Upload Form State -->
        <div class="space-y-6">
          
          {#if errorMessage}
            <!-- Error Alert -->
            <div class="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4 flex gap-3 items-start animate-in slide-in-from-top-2 duration-200">
              <svg class="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              <div>
                <h4 class="font-bold text-rose-800 dark:text-rose-400 text-sm">Failed to upload</h4>
                <p class="text-rose-700 dark:text-rose-400/90 text-xs mt-1 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          {/if}

          <!-- Drop Area -->
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <label
            for="file-upload"
            ondragover={handleDragOver}
            ondragleave={handleDragLeave}
            ondrop={handleDrop}
            class="flex flex-col items-center justify-center w-full min-h-[190px] border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300 relative overflow-hidden group
              {isDragOver 
                ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/10 shadow-lg shadow-indigo-500/5 scale-[0.99]' 
                : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 hover:bg-slate-50/50 dark:hover:bg-slate-850/50'}"
          >
            <!-- Overlay Loader/Progress -->
            {#if status === 'extracting' || status === 'uploading'}
              <div class="absolute inset-0 bg-white/95 dark:bg-slate-900/95 flex flex-col items-center justify-center p-6 space-y-4 z-20 backdrop-blur-xs">
                <div class="relative w-14 h-14">
                  <div class="absolute inset-0 border-4 border-slate-100 dark:border-slate-800 rounded-full"></div>
                  <div class="absolute inset-0 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div class="text-center">
                  <p class="text-slate-800 dark:text-slate-200 font-bold text-sm">
                    {#if status === 'extracting'}
                      Extracting text client-side...
                    {:else}
                      Uploading document text...
                    {/if}
                  </p>
                  <p class="text-slate-400 text-xs mt-1">Please keep this window open</p>
                </div>
              </div>
            {/if}

            <input
              id="file-upload"
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              class="hidden"
              onchange={handleFileSelect}
              disabled={status === 'extracting' || status === 'uploading'}
            />

            <div class="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
              <!-- Upload Icon -->
              <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-slate-800 flex items-center justify-center border border-indigo-100/50 dark:border-slate-700/50 group-hover:scale-110 transition duration-300 mb-4">
                <svg class="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
              </div>

              {#if file}
                <div class="space-y-1.5">
                  <p class="text-sm font-bold text-slate-800 dark:text-slate-200 truncate max-w-[280px]">
                    {file.name}
                  </p>
                  <p class="text-xs text-slate-400">
                    {formatBytes(file.size)} • {file.type || 'Unknown Type'}
                  </p>
                </div>
              {:else}
                <p class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Drag and drop your file here, or <span class="text-indigo-600 dark:text-indigo-400">browse</span>
                </p>
                <p class="text-xs text-slate-400">
                  Accepts PDF, TXT, and Markdown files up to 5MB
                </p>
              {/if}
            </div>
          </label>

          <!-- Submit Action Button -->
          {#if file && status === 'idle'}
            <div class="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onclick={() => { file = null; status = 'idle'; errorMessage = ''; }}
                class="px-5 py-3 rounded-2xl text-sm font-semibold border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 active:scale-95 transition"
              >
                Clear
              </button>
              <button
                type="button"
                onclick={handleUpload}
                class="flex-1 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-indigo-500/20 active:scale-95 transition"
              >
                Extract & Upload
              </button>
            </div>
          {/if}

        </div>
      {/if}

    </div>
  </div>
</main>
