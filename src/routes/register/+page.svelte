<script lang="ts">
  import { goto } from '$app/navigation';

  let name = $state('');
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleRegister(e: Event) {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        error = data.error || 'Registration failed';
        return;
      }

      goto('/');
    } catch (err: any) {
      error = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Sign Up - Smart Document Reader</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-brand-50 p-4">
  <div class="w-full max-w-sm">
    <div class="mb-8 text-center">
      <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
        <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h1 class="text-xl font-bold text-slate-800">Create Account</h1>
      <p class="mt-1 text-sm text-slate-500">Start extracting your documents</p>
    </div>

    <form onsubmit={handleRegister} class="card p-6">
      {#if error}
        <div class="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      {/if}

      <div class="space-y-4">
        <div>
          <label for="name" class="label">Name</label>
          <input
            id="name"
            type="text"
            bind:value={name}
            class="input"
            placeholder="Your name"
            autocomplete="name"
          />
        </div>

        <div>
          <label for="email" class="label">Email</label>
          <input
            id="email"
            type="email"
            bind:value={email}
            class="input"
            placeholder="you@example.com"
            required
            autocomplete="email"
          />
        </div>

        <div>
          <label for="password" class="label">Password</label>
          <input
            id="password"
            type="password"
            bind:value={password}
            class="input"
            placeholder="Min. 6 characters"
            required
            minlength="6"
            autocomplete="new-password"
          />
        </div>

        <button type="submit" class="btn-primary w-full" disabled={loading}>
          {#if loading}
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Creating account...
          {:else}
            Create Account
          {/if}
        </button>
      </div>

      <p class="mt-4 text-center text-sm text-slate-500">
        Already have an account?
        <a href="/login" class="text-brand-600 hover:text-brand-700 font-medium">Sign in</a>
      </p>
    </form>
  </div>
</div>
