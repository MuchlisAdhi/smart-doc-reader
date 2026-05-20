# Sample Invoice B2B untuk Pengujian

Folder ini berisi 3 contoh invoice B2B Indonesia yang bisa digunakan untuk menguji aplikasi.

## Files

1. **invoice-conbloc-internusa.jpg** — Invoice PT. Conbloc Internusa (material bangunan/paving block)
   - Buyer: Rangga Persada, CV
   - Total: Rp 530,278,984.65
   - 10 line items, PPN, format invoice klasik Indonesia
   - Syarat pembayaran COD, transfer BCA/Mandiri

2. **invoice-citra-aberta.jpg** — Invoice PT. Citra Aberta Cemerlang (alat berat/konstruksi)
   - Buyer: CV Sinar Mas Cemerlang
   - Total: Rp 27,900,000.00
   - 7 items (genset, molen, scrafolding, dll)
   - Payment: Bank Transfer, Net 30 days

3. **invoice-kalimantan-inti-maju.jpg** — Invoice PT. Kalimantan Inti Maju (jasa unloading barge)
   - Buyer: PT. Kutai Chip Mill
   - Total: Rp 205,362,482
   - PPN 10% + PPH 2%
   - Transfer Bank Danamon

## Cara Menguji

1. Login ke aplikasi
2. Pergi ke halaman Upload
3. Drag & drop atau pilih file-file di atas
4. Tunggu AI memproses (1-3 detik per file)
5. Review hasil extraction — perhatikan:
   - Confidence score tiap field
   - Line items yang ter-extract
   - Jumlah angka (format Rp Indonesia)
   - Buyer/vendor terdeteksi benar

## Catatan
- File asli disimpan di folder ini sebagai referensi
- Data sensitif yang terlihat sudah bersifat publik (contoh invoice umum)
- Gunakan untuk demo dan testing saja
