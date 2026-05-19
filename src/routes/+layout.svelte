<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  let { children } = $props();
  
  let user = $state<{ id: string; email: string; name: string | null; role: string } | null>(null);
  let menuOpen = $state(false);

  // Check auth on mount
  $effect(() => {
    checkAuth();
  });

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        user = data.user;
      } else {
        user = null;
      }
    } catch {
      user = null;
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    user = null;
    goto('/login');
  }

  const isAuthPage = $derived(
    $page.url.pathname === '/login' || $page.url.pathname === '/register'
  );
</script>

<svelte:head>
  <title>Smart Document Reader</title>
</svelte:head>

{#if isAuthPage}
  {@render children()}
{:else}
  <div class="min-h-screen bg-slate-50">
    <!-- Top Navigation -->
    <nav class="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <a href="/" class="flex items-center gap-2">
          <svg class="h-7 w-7 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span class="text-lg font-bold text-slate-800">DocReader</span>
        </a>

        <div class="flex items-center gap-4">
          {#if user}
            <a href="/" class="text-sm text-slate-600 hover:text-brand-600 transition {$page.url.pathname === '/' ? 'text-brand-600 font-medium' : ''}">
              Documents
            </a>
            <a href="/upload" class="text-sm text-slate-600 hover:text-brand-600 transition {$page.url.pathname === '/upload' ? 'text-brand-600 font-medium' : ''}">
              Upload
            </a>
            
            <!-- User menu -->
            <div class="relative">
              <button
                onclick={() => menuOpen = !menuOpen}
                class="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 transition"
              >
                <div class="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-medium text-xs">
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
                <span class="hidden sm:inline">{user.name || user.email}</span>
              </button>
              {#if menuOpen}
                <div class="absolute right-0 top-full mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  <div class="px-3 py-2 text-xs text-slate-500">{user.email}</div>
                  <hr class="my-1 border-slate-100" />
                  <button
                    onclick={logout}
                    class="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Sign Out
                  </button>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {@render children()}
    </main>
  </div>
{/if}

<!-- Click outside to close menu -->
{#if menuOpen}
  <button 
    class="fixed inset-0 z-30 cursor-default" 
    onclick={() => menuOpen = false}
    aria-label="Close menu"
  ></button>
{/if}
