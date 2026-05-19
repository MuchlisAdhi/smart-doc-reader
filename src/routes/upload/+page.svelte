<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let files = $state<File[]>([]);
  let dragOver = $state(false);
  let uploading = $state(false);
  let progress = $state<{ file: string; status: string; id?: string; error?: string }[]>([]);
  let pdfjsLib: any = null;

  onMount(async () => {
    // Dynamically import pdf.js for client-side PDF rendering
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
    pdfjsLib = pdfjs;
  });

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const dropped = Array.from(e.dataTransfer?.files || []);
    addFiles(dropped);
  }

  function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const selected = Array.from(input.files || []);
    addFiles(selected);
    input.value = '';
  }

  function addFiles(newFiles: File[]) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const valid = newFiles.filter((f) => {
      if (!allowed.includes(f.type)) {
        alert(`"${f.name}" is not a supported file type. Use JPG, PNG, WebP, or PDF.`);
        return false;
      }
      if (f.size > 10 * 1024 * 1024) {
        alert(`"${f.name}" exceeds 10MB limit.`);
        return false;
      }
      return true;
    });
    files = [...files, ...valid];
  }

  function removeFile(index: number) {
    files = files.filter((_, i) => i !== index);
  }

  /**
   * Render a PDF file to a PNG image using pdf.js + canvas.
   * Returns base64 PNG string (without data URL prefix).
   * Renders all pages vertically concatenated into one image.
   */
  async function renderPdfToImage(file: File): Promise<string> {
    if (!pdfjsLib) {
      throw new Error('PDF renderer not loaded. Please wait and try again.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;

    // Render each page and collect canvases
    const pageCanvases: HTMLCanvasElement[] = [];
    const scale = 2.0; // Higher resolution for better OCR

    for (let pageNum = 1; pageNum <= Math.min(totalPages, 3); pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      
      await page.render({ canvasContext: ctx, viewport }).promise;
      pageCanvases.push(canvas);
    }

    // Combine pages into single canvas (vertical stack)
    const totalWidth = Math.max(...pageCanvases.map(c => c.width));
    const totalHeight = pageCanvases.reduce((sum, c) => sum + c.height, 0);

    const combinedCanvas = document.createElement('canvas');
    combinedCanvas.width = totalWidth;
    combinedCanvas.height = totalHeight;
    const ctx = combinedCanvas.getContext('2d')!;

    let yOffset = 0;
    for (const pageCanvas of pageCanvases) {
      ctx.drawImage(pageCanvas, 0, yOffset);
      yOffset += pageCanvas.height;
    }

    // Convert to base64 PNG
    const dataUrl = combinedCanvas.toDataURL('image/png', 0.92);
    // Strip the "data:image/png;base64," prefix
    return dataUrl.split(',')[1];
  }

  async function upload() {
    if (files.length === 0) return;
    uploading = true;
    progress = files.map((f) => ({ file: f.name, status: 'pending' }));

    try {
      // First, render any PDFs to images
      progress = progress.map((p) => {
        const file = files.find(f => f.name === p.file);
        if (file?.type === 'application/pdf') {
          return { ...p, status: 'rendering' };
        }
        return { ...p, status: 'processing' };
      });

      const pdfImageData: string[] = [];
      for (const file of files) {
        if (file.type === 'application/pdf') {
          try {
            const imageBase64 = await renderPdfToImage(file);
            pdfImageData.push(imageBase64);
            // Update progress
            progress = progress.map((p) =>
              p.file === file.name ? { ...p, status: 'processing' } : p
            );
          } catch (err: any) {
            progress = progress.map((p) =>
              p.file === file.name ? { ...p, status: 'failed', error: `PDF render failed: ${err.message}` } : p
            );
            uploading = false;
            return;
          }
        }
      }

      // Build FormData
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      // Append PDF rendered images in order
      pdfImageData.forEach((img) => formData.append('pdf_images', img));

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (res.ok && data.results) {
        progress = data.results.map((r: any) => ({
          file: r.file_name,
          status: r.status,
          id: r.id,
          error: r.error
        }));

        // If all succeeded, redirect after short delay
        const allSuccess = data.results.every((r: any) => r.status === 'completed');
        if (allSuccess && data.results.length === 1) {
          setTimeout(() => goto(`/documents/${data.results[0].id}`), 1500);
        }
      } else {
        progress = progress.map((p) => ({ ...p, status: 'failed', error: data.error || 'Upload failed' }));
      }
    } catch (err: any) {
      progress = progress.map((p) => ({ ...p, status: 'failed', error: 'Network error' }));
    } finally {
      uploading = false;
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon(type: string): string {
    if (type === 'application/pdf') return '📄';
    return '🖼️';
  }
</script>

<svelte:head>
  <title>Upload Documents - Smart Document Reader</title>
</svelte:head>

<div class="mx-auto max-w-2xl">
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-slate-800">Upload Documents</h1>
    <p class="mt-1 text-sm text-slate-500">Upload receipts or invoices. AI will extract the data automatically.</p>
  </div>

  <!-- Drop Zone -->
  <div
    class="card mb-6 border-2 border-dashed p-8 text-center transition-colors {dragOver ? 'border-brand-400 bg-brand-50' : 'border-slate-300'}"
    role="button"
    tabindex="0"
    ondragover={(e) => { e.preventDefault(); dragOver = true; }}
    ondragleave={() => dragOver = false}
    ondrop={handleDrop}
  >
    <svg class="mx-auto mb-3 h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
    <p class="text-sm font-medium text-slate-700">Drag & drop files here</p>
    <p class="mt-1 text-xs text-slate-500">or click to select • JPG, PNG, WebP, PDF up to 10MB</p>
    <label class="btn-secondary mt-4 cursor-pointer text-xs">
      Browse Files
      <input
        type="file"
        class="hidden"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        multiple
        onchange={handleFileInput}
      />
    </label>
  </div>

  <!-- File List -->
  {#if files.length > 0 && !uploading && progress.length === 0}
    <div class="card mb-6 divide-y divide-slate-100">
      {#each files as file, i (i)}
        <div class="flex items-center gap-3 px-4 py-3">
          <span class="text-lg">{getFileIcon(file.type)}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-slate-700">{file.name}</p>
            <p class="text-xs text-slate-400">{formatFileSize(file.size)}{file.type === 'application/pdf' ? ' • PDF will be rendered to image for OCR' : ''}</p>
          </div>
          <button onclick={() => removeFile(i)} class="text-slate-400 hover:text-red-500" title="Remove" aria-label="Remove file">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      {/each}
    </div>

    <button onclick={upload} class="btn-primary w-full" disabled={uploading}>
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
      Upload & Process {files.length} file{files.length > 1 ? 's' : ''}
    </button>
  {/if}

  <!-- Upload Progress -->
  {#if progress.length > 0}
    <div class="card divide-y divide-slate-100">
      {#each progress as item (item.file)}
        <div class="flex items-center gap-3 px-4 py-3">
          <div class="flex-shrink-0">
            {#if item.status === 'rendering'}
              <svg class="h-5 w-5 animate-spin text-purple-600" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            {:else if item.status === 'processing'}
              <svg class="h-5 w-5 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            {:else if item.status === 'completed'}
              <svg class="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            {:else if item.status === 'failed'}
              <svg class="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            {:else}
              <div class="h-5 w-5 rounded-full border-2 border-slate-300"></div>
            {/if}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-slate-700">{item.file}</p>
            {#if item.error}
              <p class="text-xs text-red-500">{item.error}</p>
            {:else if item.status === 'rendering'}
              <p class="text-xs text-purple-600">Rendering PDF pages to image...</p>
            {:else if item.status === 'processing'}
              <p class="text-xs text-brand-600">AI extracting data...</p>
            {:else if item.status === 'completed'}
              <p class="text-xs text-green-600">Done — redirecting to review</p>
            {/if}
          </div>
          {#if item.id && item.status === 'completed'}
            <a href="/documents/{item.id}" class="text-xs text-brand-600 hover:text-brand-700 font-medium">
              Review →
            </a>
          {/if}
        </div>
      {/each}
    </div>

    {#if !uploading}
      <button onclick={() => { progress = []; files = []; }} class="btn-secondary w-full mt-4 text-xs">
        Upload More Documents
      </button>
    {/if}
  {/if}

  <!-- Tips -->
  <div class="mt-8 rounded-lg bg-amber-50 border border-amber-200 p-4">
    <h3 class="text-sm font-medium text-amber-800">💡 Tips for best results</h3>
    <ul class="mt-2 space-y-1 text-xs text-amber-700">
      <li>• Use well-lit, flat scans or photos for better OCR accuracy</li>
      <li>• Avoid blurry, dark, or heavily tilted images</li>
      <li>• The AI will flag fields it's uncertain about — always review before saving</li>
      <li>• PDF documents: up to 3 pages will be processed (combined into one image)</li>
    </ul>
  </div>
</div>
