# Smart Document Reader

Aplikasi web yang membaca dokumen keuangan B2B (invoice/faktur/nota pesanan marketplace) melalui OCR + AI, lalu mengubahnya menjadi data terstruktur yang bisa diperiksa dan diekspor.

![SvelteKit](https://img.shields.io/badge/SvelteKit-5-orange)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages%20%7C%20D1%20%7C%20R2-orange)
![Groq](https://img.shields.io/badge/AI-Groq%20Vision%20(Llama%204)-purple)

## 🏗 Stack & Arsitektur

| Layer | Teknologi | Alasan |
|-------|-----------|--------|
| Frontend + Backend | **SvelteKit** (SSR fullstack) | Satu codebase, adapter Cloudflare Pages paling native, bundle kecil, form actions cocok untuk upload/edit |
| Hosting | **Cloudflare Pages** | Terintegrasi langsung dengan D1, R2, Workers runtime |
| Database | **Cloudflare D1** (SQLite) | Persistent SQL, serverless, gratis untuk dev |
| File Storage | **Cloudflare R2** | Native binding, S3-compatible, murah, low latency |
| OCR/AI | **Groq Vision** (Llama-4-Scout-17B) | Lihat bagian OCR/AI di bawah |
| Auth | **JWT + PBKDF2** (Web Crypto API) | Stateless, native di Workers, no external dependency |
| Styling | **Tailwind CSS** | Utility-first, fast dev, responsive |

### Arsitektur Backend

Saya memilih **SSR fullstack** (SvelteKit API routes + pages dalam satu project) karena:
1. Satu deployment unit → simpler CI/CD ke Cloudflare Pages
2. Type sharing antara server & client tanpa monorepo
3. Cookie-based auth lebih seamless (httpOnly cookie di-set dari server route)
4. `platform.env` memberikan akses langsung ke D1/R2 bindings

### Pendekatan OCR/AI

**Model**: `meta-llama/llama-4-scout-17b-16e-instruct` via Groq API

**Alasan pemilihan**:
- **Akurasi**: Vision model multimodal, bisa langsung memproses gambar → JSON terstruktur dalam satu langkah (tanpa OCR engine terpisah)
- **Biaya**: Groq tier gratis cukup untuk volume dev/demo (30 req/min)
- **Kecepatan**: Latency ~1-3 detik per dokumen (Groq terkenal dengan inferensi cepat lewat LPU)
- **Simplicity**: Single API call → structured JSON, tidak perlu pipeline OCR + NER + parsing
- **Multi-language**: Prompt di-tuning untuk mengenali istilah Indonesia + Inggris secara bersamaan

**Flow**:
1. User upload image/PDF
2. Jika PDF → client-side rendering ke PNG via pdf.js (hingga 3 halaman, digabung vertikal)
3. Image di-encode base64, dikirim ke Groq Vision API
4. Prompt meminta JSON terstruktur + confidence scores per field + quality issues
5. Hasil disimpan ke D1, rendered image ke R2, user bisa review & koreksi

### Kenapa Groq Vision, bukan OCR tradisional?

| Pendekatan | Akurasi | Biaya | Kecepatan | Kompleksitas |
|------------|---------|-------|-----------|-------------|
| Tesseract + LLM | Menengah (perlu preprocessing) | Gratis | Lambat (2-step) | Tinggi |
| Google Vision API | Tinggi | Bayar per request | Cepat | Sedang |
| **Groq Vision (dipilih)** | **Tinggi** | **Gratis (tier dev)** | **Sangat cepat** | **Rendah** |

## 📋 Asumsi yang Diambil

Berdasarkan klarifikasi dari pemberi tugas:

1. **Bahasa campuran** — Dokumen bisa dalam Bahasa Indonesia, Inggris, atau campuran. Prompt AI di-tuning untuk mengenali kedua bahasa.
2. **1 file = 1 invoice** — Satu file selalu berisi satu resi/invoice, tidak perlu splitting multi-dokumen.
3. **Fokus B2B invoice** — Dioptimalkan untuk invoice supplier, nota pesanan marketplace (Shopee, Tokopedia), invoice jasa, PO, dll. Bukan receipt retail kasir.
4. **Auth sederhana** — JWT stateless tanpa refresh token rotation (cukup untuk demo)
5. **PDF rendering client-side** — Groq Vision hanya menerima image, jadi PDF di-render ke canvas di browser terlebih dahulu
6. **Confidence threshold** — < 0.5 = merah (perlu review wajib), 0.5-0.8 = kuning (perlu cek), > 0.8 = hijau (OK)
7. **Demo user** — Bisa register sendiri atau pakai demo credentials

## 🤖 AI Workflow Log

### Tools/Agent yang Dipakai

| Tool | Untuk bagian apa |
|------|-----------------|
| **Kiro (Claude Opus 4.6 in IDE)** | Scaffolding project, semua kode (backend API, frontend UI, SQL schema, auth, Groq integration) |
| **Groq Vision AI** | Runtime OCR + extraction di production |
| **pdf.js** | Client-side PDF → image conversion |

### Prompt Paling Menentukan (untuk Groq Vision — dibahas saat interview)

```
Anda adalah sistem OCR dokumen keuangan B2B (invoice/faktur). Analisis gambar dokumen yang diunggah dan ekstrak data terstruktur.

KONTEKS:
- Dokumen bisa dalam Bahasa Indonesia, Inggris, atau campuran keduanya.
- Ini adalah 1 file = 1 invoice/faktur (tidak ada multi-dokumen dalam 1 file).
- Fokus pada invoice B2B: faktur supplier, purchase order, nota pesanan marketplace (Shopee, Tokopedia, dll), invoice jasa, dll.
- Kenali istilah Indonesia: "Subtotal", "Total Pembayaran", "Diskon", "Biaya Kirim/Pengiriman", "PPN/Pajak", "Tanggal", "No. Faktur/Invoice/Pesanan", "Metode Pembayaran", "Jatuh Tempo", "Rp", "Nama Penjual/Toko", "Nama Pembeli".

DOCUMENT QUALITY HANDLING:
- The document may be blurry, dark, tilted, partially censored/redacted, or low resolution.
- Report quality issues detected.
...

RESPOND ONLY WITH VALID JSON: { vendor, buyer, document_date, total, items[], confidence{}, quality_issues[], ... }
```

**Alasan prompt ini krusial**:
- Bilingual context → model memahami "Total Pembayaran" = final paid amount
- Quality assessment built-in → user tahu dokumen mana yang perlu extra review
- Single-step extraction + validation → tidak perlu pipeline multi-step
- B2B-specific fields (buyer, payment terms, due date) di-request eksplisit
- Confidence scoring per field → visual indicator langsung di UI

## 🎯 Cara Menangani Akurasi Rendah & Dokumen Buruk

### Strategi Multi-Layer

1. **AI Quality Assessment** — AI diminta melaporkan `quality_issues` yang terdeteksi pada gambar (blur, dark, tilted, censored, handwritten, dll)

2. **Visual Quality Badges** — Di halaman review, quality issues ditampilkan sebagai badge berwarna:
   - 📷 Blurry (orange) | 🌑 Dark (gray) | ↗️ Tilted (purple)
   - 🔍 Low resolution (red) | █ Censored (slate) | ✍️ Handwritten (blue)

3. **Confidence Scoring per Field** — Setiap field memiliki skor 0.0-1.0:
   - ✓ Hijau (≥0.8): high confidence, kemungkinan besar benar
   - ⚠ Kuning (0.5-0.8): perlu verifikasi manual
   - ✗ Merah (<0.5): wild guess, wajib dicek

4. **Side-by-side Review** — Image dokumen asli ditampilkan di samping form edit agar user bisa cross-check

5. **Confidence Bar Chart** — Panel kiri menampilkan progress bar confidence per field

6. **Warning Banner** — Jika overall confidence < 70%, ditampilkan banner peringatan prominent

7. **Graceful Failure** — Jika extraction total gagal (bukan dokumen keuangan), status = failed, pesan error ditampilkan

8. **Status Flow**: `processing` → `completed` → `reviewed` (user harus klik "Verify & Save")

### Contoh Kasus yang Ditangani

| Kasus | Handling |
|-------|---------|
| PDF Shopee order | Client-side render → all pages combined → AI extracts order data |
| Invoice dengan bagian di-sensor | AI reports `partially_censored`, field yang di-block = null, confidence = 0 |
| Foto miring/blur | AI reports issues, lowers confidence, user gets clear warning |
| Tulisan tangan di invoice | AI attempts to read, reports `handwritten_text`, notes the text |
| Bukan dokumen keuangan | `document_type = "other"`, overall confidence = 0.1, clear warning |

## 📦 Fitur Implementasi

- ✅ Upload dokumen (JPG, PNG, WebP, PDF) — multi-upload support
- ✅ PDF client-side rendering (hingga 3 halaman) via pdf.js
- ✅ Ekstraksi otomatis via Groq Vision AI (single-step OCR + structuring)
- ✅ B2B invoice fields: vendor, buyer, alamat, due date, payment method/terms
- ✅ Review & koreksi form (semua field editable, bilingual labels)
- ✅ Confidence score per field (visual color coding + icons + progress bars)
- ✅ Quality issues detection & display (badges for blur/dark/tilted/etc)
- ✅ Line items dengan SKU, unit, per-item discount
- ✅ Daftar dokumen + filter (tanggal, vendor, search, buyer)
- ✅ Export CSV + JSON (includes all B2B fields)
- ✅ Pagination
- ✅ JWT authentication (register + login, httpOnly cookie)
- ✅ Image preview di review page (termasuk rendered PDF)
- ✅ Delete document (D1 + R2 cleanup)
- ✅ Responsive UI (mobile + desktop)
- ✅ Document types: invoice, receipt, purchase_order, delivery_note

## 🚀 Setup & Deployment

### Prerequisites
- Node.js 18+
- Cloudflare account (free plan cukup)
- Groq API key (gratis di [console.groq.com](https://console.groq.com))
- Wrangler CLI (sudah included sebagai devDependency, akses via `npx wrangler`)

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy env vars
cp .dev.vars.example .dev.vars
# Edit .dev.vars: isi GROQ_API_KEY dan JWT_SECRET dengan value asli

# 3. Create D1 database (local)
npx wrangler d1 create smart-doc-reader-db
# Update wrangler.toml dengan database_id dari output

# 4. Run migrations
npm run db:migrate:local

# 5. Seed demo user (optional)
npm run db:seed:local

# 6. Start dev server
npm run dev
```

### Production Deployment

```bash
# 1. Create R2 bucket
npx wrangler r2 bucket create smart-doc-reader-files

# 2. Create D1 database
npx wrangler d1 create smart-doc-reader-db
# Update wrangler.toml with database_id

# 3. Run migrations (remote)
npm run db:migrate:remote

# 4. Seed demo user (remote)
npm run db:seed:remote

# 5. Set secrets
npx wrangler pages secret put GROQ_API_KEY
npx wrangler pages secret put JWT_SECRET

# 6. Deploy
npm run deploy
```

### Demo Credentials
- **Email**: `demo@superbrands.test`
- **Password**: `demo1234`
- Atau register akun baru melalui `/register`

## 🗄 Database Schema

### Tables

**users** — Authentication
- id, email, password_hash, name, role

**documents** — Extracted invoice data
- Core: vendor, buyer, document_date, due_date, total, subtotal, tax, discount, shipping, currency
- B2B: vendor_address, buyer_address, tax_rate, payment_method, payment_terms, document_number
- AI: raw_extraction (full JSON), confidence_overall, confidence_fields, ai_model, processing_time_ms
- Status: pending → processing → completed → reviewed / failed

**document_items** — Line items per document
- description, sku, quantity, unit, unit_price, discount, total, confidence

## 🔄 Apa yang Akan Diperbaiki Bila Waktu 2x Lipat

1. **PDF multi-page enhanced** — Render tiap halaman terpisah, extract per halaman lalu merge results
2. **Batch re-processing** — Tombol retry untuk dokumen gagal, dengan model fallback
3. **Dashboard analytics** — Chart pengeluaran per vendor/bulan/currency, total outstanding
4. **Vendor auto-suggest** — Dropdown autocomplete dari vendor yang pernah muncul sebelumnya
5. **Template matching** — Jika vendor sama muncul berkali-kali, cache layout extraction untuk akurasi lebih tinggi
6. **Multi-currency conversion** — Auto-convert ke base currency (IDR) untuk reporting
7. **Image pre-processing** — Auto-rotate, brightness/contrast enhancement sebelum kirim ke AI
8. **Webhook/integration** — Export ke Google Sheets, Xero, atau software akuntansi
9. **Rate limiting & queue** — API rate limit + background job queue untuk batch uploads
10. **Audit trail** — History edits per dokumen, siapa mengubah apa dan kapan
11. **OCR fallback** — Jika Groq gagal, fallback ke Tesseract + GPT-4o-mini
12. **Duplicate detection** — Warn jika invoice number sama sudah pernah di-upload

## 📄 License

Private — dibuat untuk keperluan technical test PT Superbrands International.
