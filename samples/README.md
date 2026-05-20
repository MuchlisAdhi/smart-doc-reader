# Sample Invoice B2B untuk Pengujian

Folder ini berisi 3 contoh invoice B2B Indonesia yang bisa digunakan untuk menguji aplikasi Smart Document Reader.

## Files

### 1. invoice-conbloc-internusa.jpg
**PT. Conbloc Internusa** — Material bangunan / paving block
- **No. Invoice**: INV/CKP/23060030 A
- **Tanggal**: 21/06/2023
- **Dijual Kepada**: Rangga Persada, CV (Komp Buah Batu Regency, Bandung)
- **Dikirim Kepada**: Proyek Alun-Alun Kabupaten Ciamis
- **Items**: 10 line items (VETA 6 ABU, COBLESTONE, CLASSICO, dll)
- **PPN**: Rp 52,550,169.65
- **Total**: **Rp 530,278,984.65**
- **Syarat Pembayaran**: COD
- **Transfer ke**: BCA / Bank Mandiri (a.n. PT. Conbloc Internusa)

### 2. invoice-citra-aberta.jpg
**PT. Citra Aberta Cemerlang** — Alat berat & konstruksi
- **No. Invoice**: 2104067
- **Tanggal**: 4/7/2020
- **Invoice To**: CV Sinar Mas Cemerlang (Bangka Belitung)
- **Items**: 7 items (Mesin Genset, Molen Tiger, Meteran Laser, Scrafolding, Water Toren, Gerobak Dorong, Mesin Bor)
- **Subtotal**: Rp 27,900,000.00
- **Tax/Discount**: 0%
- **Total**: **Rp 27,900,000.00**
- **Payment**: Bank Transfer (Bank Mandiri), Net 30 days

### 3. invoice-kalimantan-inti-maju.jpg
**PT. Kalimantan Inti Maju** — Jasa unloading barge / logistik
- **No. Invoice**: 267/KIM-KCM/IV/2017
- **Tanggal**: 22 April 2017
- **Kepada**: PT. Kutai Chip Mill (Balikpapan, Kaltim)
- **Items**: Unloading barge + Hot loading (multiple qty/rates)
- **Subtotal**: Rp 190,150,446
- **PPN (10%)**: Rp 19,015,045
- **PPH (2%)**: -Rp 3,803,009
- **Total**: **Rp 205,362,482**
- **Transfer ke**: Bank Danamon Pekanbaru (a.n. PT. Kalimantan Inti Maju)

## Cara Menguji

1. Login ke aplikasi
2. Pergi ke halaman **Upload**
3. Drag & drop atau pilih file-file di atas
4. Tunggu AI memproses (~1-3 detik per file)
5. Review hasil extraction — perhatikan:
   - Confidence score tiap field
   - Line items yang ter-extract (qty, harga, subtotal per item)
   - Jumlah angka format Rp Indonesia (ribuan pakai titik)
   - Buyer/vendor terdeteksi benar
   - PPN/PPH di-extract

## Catatan
- File asli disimpan di folder ini sebagai referensi pengujian
- Data sudah bersifat publik (contoh invoice umum)
- Gunakan untuk demo dan testing saja
