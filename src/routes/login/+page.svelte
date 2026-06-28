<script>
  import { authClient } from "$lib/auth-client.js";

  let isSignUp = $state(false);
  let name = $state("");
  let email = $state("");
  let password = $state("");
  let confirmPassword = $state("");
  let isLoading = $state(false);
  let errorMessage = $state("");
  let successMessage = $state("");

  // Live password validation
  let lengthValid = $derived(password.length >= 8);
  let hasNumber = $derived(/\d/.test(password));
  let hasSpecial = $derived(/[^A-Za-z0-9]/.test(password));
  let passwordsMatch = $derived(!isSignUp || password === confirmPassword);
  
  let passwordStrength = $derived.by(() => {
    if (password.length === 0) return 0;
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength; // 0 to 5
  });

  const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
  const strengthColors = [
    "bg-slate-300 dark:bg-slate-700",
    "bg-rose-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-emerald-500"
  ];

  function toggleMode() {
    isSignUp = !isSignUp;
    errorMessage = "";
    successMessage = "";
    password = "";
    confirmPassword = "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    errorMessage = "";
    successMessage = "";

    if (!email || !password) {
      errorMessage = "Please fill in all required fields.";
      return;
    }

    if (isSignUp) {
      if (!name) {
        errorMessage = "Name is required for sign up.";
        return;
      }
      if (password.length < 8) {
        errorMessage = "Password must be at least 8 characters.";
        return;
      }
      if (password !== confirmPassword) {
        errorMessage = "Passwords do not match.";
        return;
      }
    }

    try {
      isLoading = true;
      if (isSignUp) {
        const { error } = await authClient.signUp.email({
          email,
          password,
          name,
          callbackURL: "/"
        });
        if (error) {
          errorMessage = error.message || "Failed to create account.";
        } else {
          successMessage = "Account created successfully! Logging in...";
          setTimeout(() => {
            window.location.href = "/";
          }, 1000);
        }
      } else {
        const { error } = await authClient.signIn.email({
          email,
          password,
          callbackURL: "/"
        });
        if (error) {
          errorMessage = error.message || "Invalid email or password.";
        } else {
          window.location.href = "/";
        }
      }
    } catch (err) {
      console.error(err);
      errorMessage = "An unexpected error occurred. Please try again.";
    } finally {
      isLoading = false;
    }
  }

  async function handleSocialSignIn(provider) {
    errorMessage = "";
    try {
      isLoading = true;
      await authClient.signIn.social({
        provider,
        callbackURL: "/"
      });
    } catch (err) {
      console.error(err);
      errorMessage = `Failed to sign in with ${provider}.`;
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>{isSignUp ? 'Create Account' : 'Sign In'} | Quiz Generator</title>
</svelte:head>

<main class="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
  <!-- Dynamic modern gradient background spots -->
  <div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none"></div>
  <div class="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none"></div>

  <div class="max-w-md w-full space-y-8 relative z-10">
    <!-- Brand / Title -->
    <div class="text-center">
      <h1 class="text-4xl font-extrabold tracking-tight bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent sm:text-5xl">
        QuizGenerator
      </h1>
      <p class="mt-3 text-slate-400 font-medium">
        AI-Powered MCQ & Study Card Engine
      </p>
    </div>

    <!-- Glassmorphic Form Card -->
    <div class="bg-slate-800/40 border border-slate-700/50 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-indigo-950/20">
      <!-- Tab selectors -->
      <div class="flex border-b border-slate-700/80 mb-6">
        <button
          onclick={() => { if (isSignUp) toggleMode(); }}
          class="flex-1 pb-3 text-center font-bold transition-all duration-300 {!isSignUp ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'}"
        >
          Sign In
        </button>
        <button
          onclick={() => { if (!isSignUp) toggleMode(); }}
          class="flex-1 pb-3 text-center font-bold transition-all duration-300 {isSignUp ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'}"
        >
          Register
        </button>
      </div>

      {#if errorMessage}
        <div class="mb-4 p-4 rounded-2xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-sm font-semibold flex items-center gap-2">
          <svg class="w-5 h-5 shrink-0 text-rose-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          {errorMessage}
        </div>
      {/if}

      {#if successMessage}
        <div class="mb-4 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 text-sm font-semibold flex items-center gap-2">
          <svg class="w-5 h-5 shrink-0 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          {successMessage}
        </div>
      {/if}

      <!-- Form -->
      <form onsubmit={handleSubmit} class="space-y-5">
        {#if isSignUp}
          <div>
            <label for="name" class="block text-sm font-semibold text-slate-300 mb-1.5">Full Name</label>
            <input
              type="text"
              id="name"
              bind:value={name}
              placeholder="Alex Johnson"
              required
              class="w-full bg-slate-900/60 border border-slate-700/80 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition duration-200"
            />
          </div>
        {/if}

        <div>
          <label for="email" class="block text-sm font-semibold text-slate-300 mb-1.5">Email Address</label>
          <input
            type="email"
            id="email"
            bind:value={email}
            placeholder="name@example.com"
            required
            class="w-full bg-slate-900/60 border border-slate-700/80 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition duration-200"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-semibold text-slate-300 mb-1.5">Password</label>
          <input
            type="password"
            id="password"
            bind:value={password}
            placeholder="••••••••"
            required
            class="w-full bg-slate-900/60 border border-slate-700/80 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition duration-200"
          />

          <!-- Password strength indicators for Sign Up -->
          {#if isSignUp && password.length > 0}
            <div class="mt-2.5 space-y-1.5">
              <div class="flex justify-between items-center text-xs font-semibold">
                <span class="text-slate-400">Password Strength:</span>
                <span class={passwordStrength >= 4 ? "text-emerald-400" : passwordStrength >= 2 ? "text-amber-400" : "text-rose-400"}>
                  {strengthLabels[Math.min(passwordStrength - 1, 4)] || "Too Short"}
                </span>
              </div>
              <div class="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
                {#each Array(5) as _, idx}
                  <div class="h-full flex-1 transition-all duration-300 {idx < passwordStrength ? strengthColors[Math.min(passwordStrength - 1, 4)] : 'bg-slate-700/50'}"></div>
                {/each}
              </div>
              <!-- Requirements Checklist -->
              <ul class="text-[11px] text-slate-400 space-y-0.5 mt-2">
                <li class="flex items-center gap-1.5 {lengthValid ? 'text-emerald-400' : ''}">
                  <span class="inline-block w-1.5 h-1.5 rounded-full {lengthValid ? 'bg-emerald-400' : 'bg-slate-600'}"></span>
                  At least 8 characters (12+ recommended)
                </li>
                <li class="flex items-center gap-1.5 {hasNumber ? 'text-emerald-400' : ''}">
                  <span class="inline-block w-1.5 h-1.5 rounded-full {hasNumber ? 'bg-emerald-400' : 'bg-slate-600'}"></span>
                  Contains at least one number
                </li>
                <li class="flex items-center gap-1.5 {hasSpecial ? 'text-emerald-400' : ''}">
                  <span class="inline-block w-1.5 h-1.5 rounded-full {hasSpecial ? 'bg-emerald-400' : 'bg-slate-600'}"></span>
                  Contains a special character
                </li>
              </ul>
            </div>
          {/if}
        </div>

        {#if isSignUp}
          <div>
            <label for="confirmPassword" class="block text-sm font-semibold text-slate-300 mb-1.5">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              bind:value={confirmPassword}
              placeholder="••••••••"
              required
              class="w-full bg-slate-900/60 border border-slate-700/80 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition duration-200 {confirmPassword && !passwordsMatch ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : ''}"
            />
            {#if confirmPassword && !passwordsMatch}
              <p class="text-[11px] text-rose-400 font-semibold mt-1">Passwords do not match</p>
            {/if}
          </div>
        {/if}

        <button
          type="submit"
          disabled={isLoading || (isSignUp && (!lengthValid || !passwordsMatch))}
          class="w-full mt-2 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-950/40 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition duration-200 flex items-center justify-center gap-2"
        >
          {#if isLoading}
            <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Processing...
          {:else}
            {isSignUp ? 'Create Account' : 'Sign In'}
          {/if}
        </button>
      </form>

      <!-- Social login divider -->
      <div class="relative my-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-slate-700/70"></div>
        </div>
        <div class="relative flex justify-center text-xs uppercase">
          <span class="bg-slate-850 px-3 text-slate-400 font-bold tracking-wider">Or continue with</span>
        </div>
      </div>

      <!-- Social OAuth Buttons -->
      <div class="grid grid-cols-2 gap-4">
        <button
          onclick={() => handleSocialSignIn("github")}
          disabled={isLoading}
          class="flex items-center justify-center gap-2 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-700/70 rounded-xl py-3 text-sm font-semibold active:scale-95 transition"
        >
          <!-- GitHub SVG -->
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd" />
          </svg>
          GitHub
        </button>

        <button
          onclick={() => handleSocialSignIn("google")}
          disabled={isLoading}
          class="flex items-center justify-center gap-2 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-700/70 rounded-xl py-3 text-sm font-semibold active:scale-95 transition"
        >
          <!-- Google SVG -->
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          Google
        </button>
      </div>
    </div>
  </div>
</main>

<style>
  /* Extra styling for custom backdrop/tab elements */
  .bg-slate-850 {
    background-color: #172033;
  }
</style>
