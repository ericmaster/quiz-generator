<script>
  import { authClient } from "$lib/auth-client.js";

  let { data, children } = $props();

  async function handleSignOut() {
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = "/login";
          }
        }
      });
    } catch (err) {
      console.error("Failed to sign out:", err);
      // Fallback redirect
      window.location.href = "/login";
    }
  }
</script>

<div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 transition-colors duration-300">
  <!-- Top Navigation Header -->
  <header class="border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center gap-6">
        <span class="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">QuizGenerator</span>
        {#if data.user}
          <nav class="flex items-center gap-4">
            <a href="/" class="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Dashboard</a>
            <a href="/upload" class="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Upload</a>
          </nav>
        {/if}
      </div>
      
      {#if data.user}
        <div class="flex items-center gap-4">
          <span class="text-sm font-medium text-slate-600 dark:text-slate-300 hidden sm:inline">
            Logged in as <strong class="text-slate-800 dark:text-slate-105">{data.user.name}</strong>
          </span>
          <button
            onclick={handleSignOut}
            class="bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold px-4 py-2 rounded-xl text-sm transition active:scale-95 border border-slate-200/50 dark:border-slate-750"
          >
            Sign Out
          </button>
        </div>
      {/if}
    </div>
  </header>

  {@render children()}
</div>
