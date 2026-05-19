<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  interface DocumentItem {
    id: string;
    description: string | null;
    quantity: number | null;
    unit_price: number | null;
    total: number | null;
    confidence: number | null;
  }

  interface ConfidenceFields {
    vendor: number;
    document_date: number;
    total: number;
    subtotal: number;
    tax: number;
    currency: number;
    document_number: number;
    items: number;
    overall: number;
  }

  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');
  let success = $state('');

  // Document fields
  let docId = $derived($page.params.id);
  let doc = $state<any>(null);
  let items = $state<DocumentItem[]>([]);
  let confidence = $state<ConfidenceFields | null>(null);
  let qualityIssues = $state<string[]>([]);

  // Editable form fields
  let vendor = $state('');
  let vendorAddress = $state('');
  let buyer = $state('');
  let buyerAddress = $state('');
  let documentDate = $state('');
  let dueDate = $state('');
  let total = $state('');
  let subtotal = $state('');
  let tax = $state('');
  let taxRate = $state('');
  let discount = $state('');
  let shipping = $state('');
  let currency = $state('');
  let documentNumber = $state('');
  let documentType = $state('');
  let paymentMethod = $state('');
  let paymentTerms = $state('');
  let notes = $state('');
  let editItems = $state<Array<{ description: string; sku: string; quantity: string; unit: string; unit_price: string; discount: string; total: string; confidence: number }>>([]);

  $effect(() => {
    loadDocument();
  });

  async function loadDocument() {
    loading = true;
    try {
      const res = await fetch(`/api/documents/${docId}`);
      if (!res.ok) {
        if (res.status === 404) { goto('/'); return; }
        throw new Error('Failed to load document');
      }
      const data = await res.json();
      doc = data.document;
      items = data.items || [];
      confidence = data.confidence_fields;

      // Extract quality issues from raw_extraction
      if (doc.raw_extraction) {
        try {
          const raw = JSON.parse(doc.raw_extraction);
          qualityIssues = raw.quality_issues || [];
        } catch { qualityIssues = []; }
      }

      // Populate form
      vendor = doc.vendor || '';
      vendorAddress = doc.vendor_address || '';
      buyer = doc.buyer || '';
      buyerAddress = doc.buyer_address || '';
      documentDate = doc.document_date || '';
      dueDate = doc.due_date || '';
      total = doc.total?.toString() || '';
      subtotal = doc.subtotal?.toString() || '';
      tax = doc.tax?.toString() || '';
      taxRate = doc.tax_rate || '';
      discount = doc.discount?.toString() || '';
      shipping = doc.shipping?.toString() || '';
      currency = doc.currency || '';
      documentNumber = doc.document_number || '';
      documentType = doc.document_type || '';
      paymentMethod = doc.payment_method || '';
      paymentTerms = doc.payment_terms || '';
      notes = doc.notes || '';
      editItems = items.map((i: any) => ({
        description: i.description || '',
        sku: i.sku || '',
        quantity: i.quantity?.toString() || '',
        unit: i.unit || '',
        unit_price: i.unit_price?.toString() || '',
        discount: i.discount?.toString() || '',
        total: i.total?.toString() || '',
        confidence: i.confidence || 0
      }));
    } catch (err: any) {
      error = err.message || 'Failed to load document';
    } finally {
      loading = false;
    }
  }

  async function saveDocument(markVerified = false) {
    saving = true;
    error = '';
    success = '';

    try {
      const body: any = {
        vendor: vendor || null,
        vendor_address: vendorAddress || null,
        buyer: buyer || null,
        buyer_address: buyerAddress || null,
        document_date: documentDate || null,
        due_date: dueDate || null,
        total: total || null,
        subtotal: subtotal || null,
        tax: tax || null,
        tax_rate: taxRate || null,
        discount: discount || null,
        shipping: shipping || null,
        currency: currency || null,
        document_number: documentNumber || null,
        document_type: documentType || null,
        payment_method: paymentMethod || null,
        payment_terms: paymentTerms || null,
        notes: notes || null,
        items: editItems.map((item) => ({
          description: item.description || null,
          sku: item.sku || null,
          quantity: item.quantity || null,
          unit: item.unit || null,
          unit_price: item.unit_price || null,
          discount: item.discount || null,
          total: item.total || null,
          confidence: item.confidence
        })),
        is_verified: markVerified
      };

      const res = await fetch(`/api/documents/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Save failed');
      }

      success = markVerified ? 'Document verified and saved!' : 'Changes saved!';
      if (markVerified) {
        setTimeout(() => goto('/'), 1500);
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      saving = false;
    }
  }

  function addItem() {
    editItems = [...editItems, { description: '', sku: '', quantity: '', unit: '', unit_price: '', discount: '', total: '', confidence: 1 }];
  }

  function removeItem(index: number) {
    editItems = editItems.filter((_, i) => i !== index);
  }

  function getFieldConfidence(field: keyof ConfidenceFields): number {
    return confidence?.[field] ?? 1;
  }

  function getConfidenceColor(score: number): string {
    if (score >= 0.8) return '';
    if (score >= 0.5) return 'input-error';
    return 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500';
  }

  function getConfidenceIconText(score: number): string {
    if (score >= 0.8) return '✓';
    if (score >= 0.5) return '⚠';
    return '✗';
  }

  function getConfidenceIconColor(score: number): string {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.5) return 'text-amber-600';
    return 'text-red-600';
  }

  function getConfidenceTip(score: number): string {
    if (score >= 0.8) return 'High confidence';
    if (score >= 0.5) return 'Medium confidence - please verify';
    return 'Low confidence - needs review';
  }

  function getItemBorderClass(conf: number): string {
    if (conf < 0.5) return 'border-red-200 bg-red-50/50';
    if (conf < 0.8) return 'border-amber-200 bg-amber-50/50';
    return '';
  }

  async function deleteDocument() {
    if (!confirm('Delete this document permanently?')) return;
    const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
    if (res.ok) goto('/');
  }
</script>

<svelte:head>
  <title>{vendor || doc?.file_name || 'Document'} - Smart Document Reader</title>
</svelte:head>

{#if loading}
  <div class="flex items-center justify-center py-20">
    <svg class="h-8 w-8 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
    </svg>
  </div>
{:else if doc}
  <div class="mb-4 flex items-center gap-3">
    <a href="/" class="text-slate-400 hover:text-slate-600" aria-label="Back to documents">
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </a>
    <h1 class="text-xl font-bold text-slate-800">Review Document</h1>
    {#if doc.status === 'reviewed'}
      <span class="badge bg-green-100 text-green-700">Verified</span>
    {:else if doc.status === 'failed'}
      <span class="badge bg-red-100 text-red-700">Failed</span>
    {/if}
  </div>

  <!-- Messages -->
  {#if error}
    <div class="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
  {/if}
  {#if success}
    <div class="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">{success}</div>
  {/if}

  <!-- Confidence banner -->
  {#if confidence && confidence.overall < 0.7}
    <div class="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
      <p class="text-sm font-medium text-amber-800">⚠️ Low overall confidence ({Math.round(confidence.overall * 100)}%)</p>
      <p class="text-xs text-amber-600 mt-1">
        The AI had difficulty reading this document. Fields highlighted in yellow/red need your review.
        This may be due to image quality (blur, dark, tilted) or non-standard document format.
      </p>
    </div>
  {/if}

  <!-- Quality issues banner -->
  {#if qualityIssues.length > 0}
    <div class="mb-4 rounded-lg bg-slate-100 border border-slate-300 px-4 py-3">
      <p class="text-sm font-medium text-slate-700">📷 Image quality issues detected</p>
      <div class="mt-2 flex flex-wrap gap-2">
        {#each qualityIssues as issue}
          <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium
            {issue === 'blurry' ? 'bg-orange-100 text-orange-700' : 
             issue === 'dark' ? 'bg-gray-200 text-gray-700' :
             issue === 'tilted' || issue === 'skewed' ? 'bg-purple-100 text-purple-700' :
             issue === 'low_resolution' ? 'bg-red-100 text-red-700' :
             issue === 'partially_censored' ? 'bg-slate-200 text-slate-700' :
             issue === 'handwritten_text' ? 'bg-blue-100 text-blue-700' :
             issue === 'noise' ? 'bg-yellow-100 text-yellow-700' :
             issue === 'overexposed' ? 'bg-amber-100 text-amber-700' :
             issue === 'crumpled' ? 'bg-rose-100 text-rose-700' :
             'bg-slate-100 text-slate-600'}">
            {#if issue === 'blurry'}📷{:else if issue === 'dark'}🌑{:else if issue === 'tilted' || issue === 'skewed'}↗️{:else if issue === 'low_resolution'}🔍{:else if issue === 'partially_censored'}█{:else if issue === 'handwritten_text'}✍️{:else if issue === 'noise'}〰️{:else if issue === 'overexposed'}☀️{:else if issue === 'crumpled'}📃{:else}⚠️{/if}
            {issue.replace('_', ' ')}
          </span>
        {/each}
      </div>
      <p class="mt-2 text-xs text-slate-500">
        These issues may affect extraction accuracy. Please carefully verify all fields below.
      </p>
    </div>
  {/if}

  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <!-- Left: Image preview -->
    <div class="lg:col-span-1">
      <div class="card sticky top-20 overflow-hidden">
        <div class="border-b border-slate-100 px-4 py-3">
          <p class="text-xs font-medium text-slate-600 truncate">{doc.file_name}</p>
          <p class="text-xs text-slate-400">{(doc.file_size / 1024).toFixed(1)} KB • {doc.file_type}</p>
        </div>
        <div class="bg-slate-100 p-2">
            <img
              src="/api/documents/{docId}/image"
              alt="Document scan"
              class="w-full rounded"
              loading="lazy"
            />
        </div>
        {#if confidence}
          <div class="px-4 py-3 border-t border-slate-100">
            <p class="text-xs font-medium text-slate-600 mb-2">AI Confidence Scores</p>
            <div class="space-y-1">
              {#each Object.entries(confidence) as [field, score]}
                {#if field !== 'overall'}
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-slate-500 w-24 capitalize">{field.replace('_', ' ')}</span>
                    <div class="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full {score >= 0.8 ? 'bg-green-500' : score >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}"
                        style="width: {Math.round(Number(score) * 100)}%"
                      ></div>
                    </div>
                    <span class="text-xs text-slate-400 w-8 text-right">{Math.round(Number(score) * 100)}%</span>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {/if}
        {#if doc.processing_time_ms}
          <div class="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
            Processed in {doc.processing_time_ms}ms • {doc.ai_model}
          </div>
        {/if}
        {#if qualityIssues.length > 0}
          <div class="px-4 py-2 border-t border-slate-100">
            <p class="text-xs font-medium text-slate-500 mb-1">Quality Assessment</p>
            <p class="text-xs text-slate-400">{qualityIssues.length} issue{qualityIssues.length > 1 ? 's' : ''}: {qualityIssues.join(', ')}</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Right: Edit form -->
    <div class="lg:col-span-2">
      <form onsubmit={(e) => { e.preventDefault(); saveDocument(false); }}>
        <div class="card p-6">
          <h2 class="text-lg font-semibold text-slate-800 mb-4">Extracted Data</h2>
          <p class="text-xs text-slate-500 mb-6">
            Fields marked with ⚠ or ✗ have low AI confidence. Please verify and correct them before saving.
          </p>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <!-- Vendor / Seller -->
            <div>
              <div class="flex items-center gap-2 mb-1">
                <label for="vendor" class="label mb-0">Vendor / Seller</label>
                <span class="{getConfidenceIconColor(getFieldConfidence('vendor'))} text-xs" title={getConfidenceTip(getFieldConfidence('vendor'))}>{getConfidenceIconText(getFieldConfidence('vendor'))}</span>
              </div>
              <input id="vendor" type="text" bind:value={vendor} class="input {getConfidenceColor(getFieldConfidence('vendor'))}" placeholder="Nama penjual/toko" />
            </div>

            <!-- Buyer -->
            <div>
              <label for="buyer" class="label">Buyer / Pembeli</label>
              <input id="buyer" type="text" bind:value={buyer} class="input" placeholder="Nama pembeli" />
            </div>

            <!-- Vendor Address -->
            <div>
              <label for="vendorAddr" class="label">Vendor Address</label>
              <input id="vendorAddr" type="text" bind:value={vendorAddress} class="input" placeholder="Alamat penjual" />
            </div>

            <!-- Buyer Address -->
            <div>
              <label for="buyerAddr" class="label">Buyer Address</label>
              <input id="buyerAddr" type="text" bind:value={buyerAddress} class="input" placeholder="Alamat pembeli" />
            </div>

            <!-- Document Number -->
            <div>
              <div class="flex items-center gap-2 mb-1">
                <label for="docNum" class="label mb-0">Invoice / Order No.</label>
                <span class="{getConfidenceIconColor(getFieldConfidence('document_number'))} text-xs" title={getConfidenceTip(getFieldConfidence('document_number'))}>{getConfidenceIconText(getFieldConfidence('document_number'))}</span>
              </div>
              <input id="docNum" type="text" bind:value={documentNumber} class="input {getConfidenceColor(getFieldConfidence('document_number'))}" placeholder="INV-001 / No. Pesanan" />
            </div>

            <!-- Document Type -->
            <div>
              <label for="docType" class="label">Type</label>
              <select id="docType" bind:value={documentType} class="input">
                <option value="">Select</option>
                <option value="invoice">Invoice / Faktur</option>
                <option value="receipt">Receipt / Struk</option>
                <option value="purchase_order">Purchase Order</option>
                <option value="delivery_note">Delivery Note / Surat Jalan</option>
                <option value="other">Other</option>
              </select>
            </div>

            <!-- Date -->
            <div>
              <div class="flex items-center gap-2 mb-1">
                <label for="docDate" class="label mb-0">Tanggal / Date</label>
                <span class="{getConfidenceIconColor(getFieldConfidence('document_date'))} text-xs" title={getConfidenceTip(getFieldConfidence('document_date'))}>{getConfidenceIconText(getFieldConfidence('document_date'))}</span>
              </div>
              <input id="docDate" type="date" bind:value={documentDate} class="input {getConfidenceColor(getFieldConfidence('document_date'))}" />
            </div>

            <!-- Due Date -->
            <div>
              <label for="dueDate" class="label">Due Date / Jatuh Tempo</label>
              <input id="dueDate" type="date" bind:value={dueDate} class="input" />
            </div>

            <!-- Currency -->
            <div>
              <div class="flex items-center gap-2 mb-1">
                <label for="currency" class="label mb-0">Currency</label>
                <span class="{getConfidenceIconColor(getFieldConfidence('currency'))} text-xs" title={getConfidenceTip(getFieldConfidence('currency'))}>{getConfidenceIconText(getFieldConfidence('currency'))}</span>
              </div>
              <select id="currency" bind:value={currency} class="input {getConfidenceColor(getFieldConfidence('currency'))}">
                <option value="">Select</option>
                <option value="IDR">IDR - Rupiah</option>
                <option value="USD">USD - US Dollar</option>
                <option value="SGD">SGD - Singapore Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="MYR">MYR - Malaysian Ringgit</option>
                <option value="JPY">JPY - Japanese Yen</option>
                <option value="AUD">AUD - Australian Dollar</option>
                <option value="CNY">CNY - Chinese Yuan</option>
              </select>
            </div>

            <!-- Payment Method -->
            <div>
              <label for="payMethod" class="label">Payment Method</label>
              <input id="payMethod" type="text" bind:value={paymentMethod} class="input" placeholder="Transfer/SPayLater/COD/etc" />
            </div>

            <!-- Subtotal -->
            <div>
              <div class="flex items-center gap-2 mb-1">
                <label for="subtotal" class="label mb-0">Subtotal</label>
                <span class="{getConfidenceIconColor(getFieldConfidence('subtotal'))} text-xs" title={getConfidenceTip(getFieldConfidence('subtotal'))}>{getConfidenceIconText(getFieldConfidence('subtotal'))}</span>
              </div>
              <input id="subtotal" type="number" step="0.01" bind:value={subtotal} class="input {getConfidenceColor(getFieldConfidence('subtotal'))}" placeholder="0" />
            </div>

            <!-- Discount -->
            <div>
              <label for="discount" class="label">Diskon / Discount</label>
              <input id="discount" type="number" step="0.01" bind:value={discount} class="input" placeholder="0" />
            </div>

            <!-- Shipping -->
            <div>
              <label for="shipping" class="label">Ongkir / Shipping</label>
              <input id="shipping" type="number" step="0.01" bind:value={shipping} class="input" placeholder="0" />
            </div>

            <!-- Tax -->
            <div>
              <div class="flex items-center gap-2 mb-1">
                <label for="tax" class="label mb-0">PPN / Tax</label>
                <span class="{getConfidenceIconColor(getFieldConfidence('tax'))} text-xs" title={getConfidenceTip(getFieldConfidence('tax'))}>{getConfidenceIconText(getFieldConfidence('tax'))}</span>
              </div>
              <input id="tax" type="number" step="0.01" bind:value={tax} class="input {getConfidenceColor(getFieldConfidence('tax'))}" placeholder="0" />
            </div>

            <!-- Tax Rate -->
            <div>
              <label for="taxRate" class="label">Tax Rate</label>
              <input id="taxRate" type="text" bind:value={taxRate} class="input" placeholder="e.g. PPN 11%" />
            </div>

            <!-- Total -->
            <div>
              <div class="flex items-center gap-2 mb-1">
                <label for="total" class="label mb-0">Total Pembayaran</label>
                <span class="{getConfidenceIconColor(getFieldConfidence('total'))} text-xs" title={getConfidenceTip(getFieldConfidence('total'))}>{getConfidenceIconText(getFieldConfidence('total'))}</span>
              </div>
              <input id="total" type="number" step="0.01" bind:value={total} class="input {getConfidenceColor(getFieldConfidence('total'))}" placeholder="0" />
            </div>

            <!-- Payment Terms -->
            <div>
              <label for="payTerms" class="label">Payment Terms</label>
              <input id="payTerms" type="text" bind:value={paymentTerms} class="input" placeholder="Net 30 / COD / etc" />
            </div>

            <!-- Notes -->
            <div class="sm:col-span-2">
              <label for="notes" class="label">Notes / Catatan</label>
              <textarea id="notes" bind:value={notes} class="input" rows="2" placeholder="Catatan tambahan..."></textarea>
            </div>
          </div>
        </div>

        <!-- Line Items -->
        <div class="card mt-6 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-slate-800">Line Items</h2>
            <button type="button" onclick={addItem} class="btn-secondary text-xs">
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Item
            </button>
          </div>

          {#if editItems.length === 0}
            <p class="text-sm text-slate-400 text-center py-4">No line items extracted</p>
          {:else}
            <div class="space-y-3">
              {#each editItems as item, i (i)}
                <div class="rounded-lg border border-slate-200 p-3 {getItemBorderClass(item.confidence)}">
                  <div class="flex items-start gap-2">
                    <span class="{getConfidenceIconColor(item.confidence)} text-xs mt-2" title={getConfidenceTip(item.confidence)}>{getConfidenceIconText(item.confidence)}</span>
                    <div class="flex-1 space-y-2">
                      <div class="grid grid-cols-1 gap-2 sm:grid-cols-12">
                        <input type="text" bind:value={item.description} class="input sm:col-span-6" placeholder="Description / Nama produk" />
                        <input type="text" bind:value={item.sku} class="input sm:col-span-3" placeholder="SKU/Code" />
                        <input type="text" bind:value={item.unit} class="input sm:col-span-2" placeholder="Unit" />
                        <button type="button" onclick={() => removeItem(i)} class="text-red-400 hover:text-red-600 sm:col-span-1 flex items-center justify-center" aria-label="Remove item">
                          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div class="grid grid-cols-4 gap-2">
                        <input type="number" step="0.01" bind:value={item.quantity} class="input" placeholder="Qty" />
                        <input type="number" step="0.01" bind:value={item.unit_price} class="input" placeholder="Unit Price" />
                        <input type="number" step="0.01" bind:value={item.discount} class="input" placeholder="Discount" />
                        <input type="number" step="0.01" bind:value={item.total} class="input" placeholder="Total" />
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Actions -->
        <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button type="button" onclick={deleteDocument} class="btn-danger text-xs order-2 sm:order-1">
            Delete Document
          </button>
          <div class="flex gap-3 order-1 sm:order-2">
            <button type="submit" class="btn-secondary flex-1 sm:flex-initial" disabled={saving}>
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              onclick={() => saveDocument(true)}
              class="btn-primary flex-1 sm:flex-initial"
              disabled={saving}
            >
              {saving ? 'Saving...' : '✓ Verify & Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
{/if}
