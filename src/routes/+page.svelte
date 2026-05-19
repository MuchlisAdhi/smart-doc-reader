<script lang="ts">
  import { goto } from '$app/navigation';

  interface Document {
    id: string;
    file_name: string;
    vendor: string | null;
    document_date: string | null;
    total: number | null;
    currency: string | null;
    document_type: string | null;
    status: string;
    confidence_overall: number | null;
    is_verified: number;
    created_at: number;
  }

  let documents = $state<Document[]>([]);
  let loading = $state(true);
  let totalCount = $state(0);
  let currentPage = $state(1);
  let totalPages = $state(1);

  // Filters
  let searchQuery = $state('');
  let filterVendor = $state('');
  let filterDateFrom = $state('');
  let filterDateTo = $state('');
  let exporting = $state(false);

  $effect(() => {
    loadDocuments();
  });

  async function loadDocuments() {
    loading = true;
    try {
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      if (searchQuery) params.set('search', searchQuery);
      if (filterVendor) params.set('vendor', filterVendor);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);

      const res = await fetch(`/api/documents?${params}`);
      if (res.ok) {
        const data = await res.json();
        documents = data.documents;
        totalCount = data.pagination.total;
        totalPages = data.pagination.totalPages;
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      loading = false;
    }
  }

  function applyFilters() {
    currentPage = 1;
    loadDocuments();
  }

  function clearFilters() {
    searchQuery = '';
    filterVendor = '';
    filterDateFrom = '';
    filterDateTo = '';
    currentPage = 1;
    loadDocuments();
  }

  async function exportDocuments(format: 'csv' | 'json') {
    exporting = true;
    try {
      const params = new URLSearchParams();
      params.set('format', format);
      if (filterVendor) params.set('vendor', filterVendor);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);

      const res = await fetch(`/api/documents/export?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `documents_export.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      exporting = false;
    }
  }

  async function deleteDoc(id: string, fileName: string) {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (res.ok) {
      documents = documents.filter((d) => d.id !== id);
      totalCount--;
    }
  }

  function getConfidenceBadge(confidence: number | null) {
    if (confidence === null) return { color: 'bg-slate-100 text-slate-600', label: 'Unknown' };
    if (confidence >= 0.8) return { color: 'bg-green-100 text-green-700', label: 'High' };
    if (confidence >= 0.5) return { color: 'bg-amber-100 text-amber-700', label: 'Medium' };
    return { color: 'bg-red-100 text-red-700', label: 'Low' };
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'completed': return 'bg-blue-100 text-blue-700';
      case 'reviewed': return 'bg-green-100 text-green-700';
      case 'processing': return 'bg-yellow-100 text-yellow-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  }

  function formatCurrency(amount: number | null, currency: string | null): string {
    if (amount === null) return '-';
    const curr = currency || 'IDR';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr }).format(amount);
    } catch {
      return `${curr} ${amount.toLocaleString()}`;
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }
</script>

<div>
  <!-- Header -->
  <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Documents</h1>
      <p class="text-sm text-slate-500">{totalCount} document{totalCount !== 1 ? 's' : ''} processed</p>
    </div>
    <div class="flex gap-2">
      <div class="relative">
        <button 
          onclick={() => exportDocuments('csv')}
          class="btn-secondary text-xs"
          disabled={exporting || totalCount === 0}
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>
      <button 
        onclick={() => exportDocuments('json')}
        class="btn-secondary text-xs"
        disabled={exporting || totalCount === 0}
      >
        Export JSON
      </button>
      <a href="/upload" class="btn-primary text-xs">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Upload
      </a>
    </div>
  </div>

  <!-- Filters -->
  <div class="card mb-6 p-4">
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search documents..."
        class="input"
        onkeydown={(e) => { if (e.key === 'Enter') applyFilters(); }}
      />
      <input
        type="text"
        bind:value={filterVendor}
        placeholder="Filter by vendor"
        class="input"
      />
      <input
        type="date"
        bind:value={filterDateFrom}
        class="input"
        aria-label="From date"
      />
      <input
        type="date"
        bind:value={filterDateTo}
        class="input"
        aria-label="To date"
      />
      <div class="flex gap-2">
        <button onclick={applyFilters} class="btn-primary flex-1 text-xs">Filter</button>
        <button onclick={clearFilters} class="btn-secondary flex-1 text-xs">Clear</button>
      </div>
    </div>
  </div>

  <!-- Document List -->
  {#if loading}
    <div class="flex items-center justify-center py-20">
      <svg class="h-8 w-8 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
    </div>
  {:else if documents.length === 0}
    <div class="card flex flex-col items-center justify-center py-16 text-center">
      <svg class="mb-4 h-16 w-16 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 class="text-lg font-medium text-slate-600">No documents yet</h3>
      <p class="mt-1 text-sm text-slate-400">Upload your first receipt or invoice to get started</p>
      <a href="/upload" class="btn-primary mt-4">Upload Document</a>
    </div>
  {:else}
    <div class="space-y-3">
      {#each documents as doc (doc.id)}
        {@const confidence = getConfidenceBadge(doc.confidence_overall)}
        <div class="card flex items-center gap-4 p-4 transition hover:shadow-md">
          <!-- Type icon -->
          <div class="hidden sm:flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
            {#if doc.document_type === 'invoice'}
              <svg class="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            {:else}
              <svg class="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            {/if}
          </div>

          <!-- Info -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <a href="/documents/{doc.id}" class="text-sm font-medium text-slate-800 hover:text-brand-600 truncate">
                {doc.vendor || doc.file_name}
              </a>
              <span class="badge {getStatusBadge(doc.status)}">{doc.status}</span>
              <span class="badge {confidence.color}">{confidence.label}</span>
            </div>
            <div class="mt-1 flex items-center gap-3 text-xs text-slate-500">
              <span>{formatDate(doc.document_date)}</span>
              {#if doc.buyer}
                <span>→ {doc.buyer}</span>
              {/if}
              <span>{doc.file_name}</span>
            </div>
          </div>

          <!-- Amount -->
          <div class="text-right">
            <div class="text-sm font-semibold text-slate-800">
              {formatCurrency(doc.total, doc.currency)}
            </div>
            <div class="text-xs text-slate-400">{doc.currency || ''}</div>
          </div>

          <!-- Actions -->
          <div class="flex gap-1">
            <a href="/documents/{doc.id}" class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600" title="View/Edit">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </a>
            <button onclick={() => deleteDoc(doc.id, doc.file_name)} class="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      {/each}
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="mt-6 flex items-center justify-center gap-2">
        <button
          onclick={() => { currentPage--; loadDocuments(); }}
          disabled={currentPage <= 1}
          class="btn-secondary text-xs"
        >
          Previous
        </button>
        <span class="text-sm text-slate-600">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onclick={() => { currentPage++; loadDocuments(); }}
          disabled={currentPage >= totalPages}
          class="btn-secondary text-xs"
        >
          Next
        </button>
      </div>
    {/if}
  {/if}
</div>
