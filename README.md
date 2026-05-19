# Smart Document Reader

Aplikasi web yang membaca dokumen keuangan (resi/struk/invoice) melalui OCR + AI, lalu mengubahnya menjadi data terstruktur yang bisa diperiksa dan diekspor.

![SvelteKit](https://img.shields.io/badge/SvelteKit-4-orange)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers%20%7C%20Pages-orange)
![Groq](https://img.shields.io/badge/AI-Groq%20Vision-purple)

## 🏗 Stack & Arsitektur

| Layer | Teknologi | Alasan |
|-------|-----------|--------|
| Frontend + Backend | **SvelteKit** (SSR fullstack) | Satu codebase, adapter Cloudflare Pages paling native, bundle kecil, form actions cocok untuk upload/edit |
| Hosting | **Cloudflare Pages** | Terintegrasi langsung dengan D1, R2, Workers runtime |
| Database | **Cloudflare D1** (SQLite) | Persist, SQL, serverless |
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
- **Biaya**: Groq tier gratis sudah cukup untuk volume dev/demo (30 req/min)
- **Kecepatan**: Latency ~1-3 detik per dokumen (Groq terkenal dengan inferensi cepat lewat LPU)
- **Simplicity**: Single API call → structured JSON, tidak perlu pipeline OCR + NER + parsing

**Flow**:
1. User upload image/PDF
2. Image di-encode base64, dikirim ke Groq Vision API
3. Prompt meminta JSON terstruktur + confidence scores per field
4. Hasil langsung disimpan ke D1, user bisa review & koreksi

## 📋 Asumsi yang Diambil

1. **Single-page PDF**: Untuk MVP, hanya halaman pertama PDF yang diproses (Groq Vision menerima gambar)
2. **Auth sederhana**: JWT stateless tanpa refresh token rotation (cukup untuk demo)
3. **Tanpa multi-tenancy lanjut**: Semua user setara (tidak ada admin panel)
4. **R2 presigned URL tidak dipakai**: Image di-proxy melalui API route untuk keamanan
5. **Confidence threshold**: < 0.5 = merah (perlu review), 0.5-0.8 = kuning, > 0.8 = hijau
6. **Demo user**: Bisa register sendiri atau pakai demo@superbrands.test / demo1234

## 🤖 AI Workflow Log

### Tools/Agent yang Dipakai
- **Kiro (Claude Opus 4.6 in IDE)**: Scaffolding project, menulis semua kode (backend, frontend, SQL schema, API routes)
- **Groq Vision AI**: Runtime OCR + extraction di production

### Prompt Paling Menentukan (untuk Groq Vision)

```
You are a precise financial document OCR system. Analyze the uploaded receipt/invoice image and extract structured data.

INSTRUCTIONS:
1. Extract all visible text and financial data from the document.
2. For each field, provide a confidence score from 0.0 to 1.0:
   - 1.0 = clearly legible, very confident
   - 0.7-0.9 = partially legible, somewhat confident
   - 0.3-0.6 = blurry/unclear, low confidence (guess)
   - 0.0-0.2 = not found or unreadable
3. Dates must be in ISO format YYYY-MM-DD.
4. Amounts must be numeric (no currency symbols).
5. Currency should be ISO 4217 code (e.g., IDR, USD, SGD, EUR).
6. If the image is not a receipt/invoice, set document_type to "other" and set overall confidence very low.
7. For blurry/dark/tilted documents, do your best and reflect uncertainty in confidence scores.

RESPOND ONLY WITH VALID JSON matching this exact schema: { ... }
```

**Alasan prompt ini krusial**: Dengan satu prompt terstruktur + `response_format: json_object`, kita bisa mendapatkan extraction yang reliable dan confidence score secara bersamaan — menghilangkan kebutuhan pipeline multi-step (OCR → NER → parsing → validation).

## 🎯 Cara Menangani Akurasi Rendah

1. **Confidence Scores**: AI diminta memberikan skor per field. Skor < 0.5 ditandai merah, 0.5-0.8 kuning
2. **Visual Indicators**: Field yang uncertain di-highlight dengan border kuning/merah dan ikon ⚠/✗
3. **Side-by-side Review**: Image dokumen asli ditampilkan di samping form edit agar user bisa cross-check
4. **Confidence Bar Chart**: Panel kiri menampilkan progress bar confidence per field
5. **Banner Warning**: Jika overall confidence < 70%, ditampilkan banner peringatan di atas form
6. **Wajib Review**: Status "completed" berbeda dari "reviewed" — user harus klik "Verify & Save" untuk konfirmasi
7. **Graceful Failure**: Jika extraction total gagal (dokumen bukan resi), status = failed, pesan error ditampilkan

## 🚀 Setup & Deployment

### Prerequisites
- Node.js 18+
- Cloudflare account (free plan)
- Groq API key (gratis di console.groq.com)
- Wrangler CLI: `npm install -g wrangler`

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy env vars
cp .dev.vars.example .dev.vars
# Edit .dev.vars: add GROQ_API_KEY and JWT_SECRET

# 3. Create D1 database (local)
wrangler d1 create smart-doc-reader-db
# Update wrangler.toml with the database_id from output

# 4. Run migrations
npm run db:migrate:local

# 5. Start dev server
npm run dev
```

### Production Deployment

```bash
# 1. Create R2 bucket
wrangler r2 bucket create smart-doc-reader-files

# 2. Create D1 database 
wrangler d1 create smart-doc-reader-db
# Update wrangler.toml with database_id

# 3. Run migrations (remote)
npm run db:migrate:remote

# 4. Set secrets
wrangler pages secret put GROQ_API_KEY
wrangler pages secret put JWT_SECRET

# 5. Deploy
npm run deploy
```

### Demo Credentials
- **Email**: demo@superbrands.test
- **Password**: demo1234
- (atau register akun baru melalui /register)

## 📦 Fitur Implementasi

- ✅ Upload dokumen (JPG, PNG, WebP, PDF) — multi-upload
- ✅ Ekstraksi otomatis via Groq Vision AI
- ✅ Review & koreksi form (semua field editable)
- ✅ Confidence score per field (visual color coding + icons)
- ✅ Daftar dokumen + filter (tanggal, vendor, search)
- ✅ Export CSV + JSON
- ✅ Pagination
- ✅ JWT authentication (register + login)
- ✅ Image preview di review page
- ✅ Line items extraction + edit
- ✅ Responsive UI (mobile + desktop)
- ✅ Delete document (D1 + R2 cleanup)

## 🔄 Apa yang akan diperbaiki bila waktu 2x lipat

1. **PDF multi-page support**: Render tiap halaman PDF ke canvas via pdf.js, extract per halaman
2. **Batch re-processing**: Tombol retry untuk dokumen yang gagal, dengan model fallback
3. **Dashboard analytics**: Chart pengeluaran per vendor/bulan/currency
4. **Drag-to-reorder items**: Sortable line items
5. **Category/tag system**: Tagging dokumen untuk organisasi lebih baik
6. **Multi-language OCR prompt tuning**: Prompt spesifik untuk resi Indonesia vs English
7. **Image pre-processing**: Auto-rotate, brightness/contrast enhancement sebelum kirim ke AI
8. **Webhook/integration**: Export ke Google Sheets atau akuntansi software
9. **Rate limiting**: API rate limit untuk production
10. **Audit trail**: History edits per dokumen

## 📄 License

Private — dibuat untuk keperluan technical test PT Superbrands International.
