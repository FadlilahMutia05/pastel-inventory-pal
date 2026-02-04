

# Mao~Mao Store - Blindbox Manager System
**Sistem Manajemen Penjualan & Stok dengan Aesthetic Pastel**

---

## 🎨 Design System

**Color Palette (Multi-Color Pastel)**
- **Pink**: Untuk aksi utama dan highlight
- **Lavender**: Untuk header dan navigasi
- **Mint/Teal**: Untuk status sukses dan chart positif
- **Peach/Cream**: Untuk background cards
- **Sky Blue**: Untuk informasi dan badges
- **Gradients**: Pink-to-purple untuk welcome screen dan buttons

**Visual Style**
- Rounded corners (16-24px radius)
- Soft shadows dengan warna pastel
- Ikon-ikon cute/kawaii style
- Animasi smooth untuk transisi halaman
- Glass morphism effect untuk cards

---

## 📱 Halaman & Fitur

### A. Welcome Screen
- Animasi logo Mao~Mao Store dengan efek sparkle ✨
- Gradient background pink-purple
- Tombol "Masuk ke Dashboard" dengan hover animation
- Tagline: "Kelola bisnis blindbox Anda dengan mudah dan indah"

### B. Dashboard (10 Stats Cards)
1. **Total Produk** - Jumlah SKU aktif
2. **Stok Ready** - Total unit siap jual
3. **Floating Asset** - Nilai barang OTW dari supplier
4. **Profit Hari Ini** - Keuntungan transaksi hari ini
5. **Profit Bulan Ini** - Keuntungan bulan berjalan
6. **Penjualan Hari Ini** - Jumlah transaksi hari ini
7. **Pending Kirim** - Pesanan belum dikirim
8. **Stok Menipis** - Alert produk stok rendah
9. **Kargo OTW** - Jumlah pengiriman dalam perjalanan
10. **Top Seller** - Produk terlaris bulan ini

**Charts**
- Bar Chart: Penjualan 7 hari terakhir
- Pie Chart: Distribusi penjualan per kategori

### C. Kelola Stok
- **Tabel produk** dengan kolom: Foto, SKU, Nama, Kategori, Stok (pcs/set/karton), Harga Jual, Status
- **Search & Filter**: By SKU, nama produk, kategori, status stok
- **Multi-unit support**: Konversi pcs ↔ set ↔ karton
- **CRUD Produk**:
  - Upload foto (URL atau file upload via Supabase Storage)
  - Input harga modal (untuk kalkulasi FIFO)
  - Set threshold stok menipis
- **Batch management**: Tracking stok per batch dengan harga modal berbeda

### D. Kargo Masuk (OTW Tracking)
- **Daftar kargo** dari supplier China
- **Status tracking**: Ordered → Shipped → Customs → Arrived
- **Input manual** nomor resi supplier
- **Floating asset value**: Total nilai barang OTW
- **Mark as Received**: Pindahkan ke stok aktif dengan harga modal

### E. Penjualan (FIFO Logic)
**FIFO (First-In First-Out) Implementation:**
- Sistem otomatis mengambil stok dari batch terlama
- Kalkulasi profit berdasarkan harga modal batch yang dijual
- Support partial fulfillment (jual sebagian dari batch)

**Form Penjualan:**
- Pilih produk + jumlah
- Auto-calculate harga jual & profit
- Input resi pengiriman customer
- Pilih ekspedisi (JNE, SiCepat, J&T, dll)
- Status: Pending → Dikemas → Dikirim → Selesai

### F. Transaksi Harian + Export Resi Grup
- **Daftar transaksi** per hari dengan filter tanggal
- **Detail transaksi**: Produk, qty, harga, profit, resi, status
- **Export Resi Grup** → Format WhatsApp:
  ```
  🎁 Resi Pengiriman Mao~Mao Store
  📦 [Nama Customer]
  📍 [Kota Tujuan]
  🚚 [Ekspedisi]: [Nomor Resi]
  ✨ Terima kasih sudah belanja!
  ```
- **Bulk copy** semua resi untuk paste ke grup WA

### G. Laporan Periodik
- **Filter periode**: Harian, Mingguan, Bulanan, Custom range
- **Summary**: Total penjualan, total profit, rata-rata margin
- **Top products** periode tersebut
- **Export CSV**: Download data transaksi lengkap

### H. Sales Chart Component
- **Line Chart**: Trend penjualan over time
- **Bar Chart**: Perbandingan penjualan per produk
- **Pie Chart**: Distribusi penjualan per kategori
- **Interactive**: Hover untuk detail, filter by periode

---

## 🧾 Fitur Tambahan

### Print Invoice/Receipt
- Template struk dengan branding Mao~Mao Store
- Detail: Tanggal, nomor transaksi, produk, qty, harga, total
- Opsi print atau save as PDF

### Manajemen Supplier
- Daftar supplier dengan info kontak
- Tracking riwayat pembelian per supplier
- Notes dan rating supplier

---

## 📐 Layout & Navigation

**Header**
- Logo Mao~Mao Store (kiri)
- Notifikasi bell (stok menipis alerts)
- Quick stats: Profit hari ini

**Tab Navigation (Bottom/Side)**
- 🏠 Dashboard
- 📦 Stok
- 🚚 Kargo
- 💰 Penjualan
- 📊 Laporan
- ⚙️ Settings

---

## ☁️ Backend (Lovable Cloud + Supabase)

**Database Tables:**
- `products` - Master produk
- `product_batches` - Batch stok dengan harga modal (untuk FIFO)
- `cargo_shipments` - Kargo masuk dari supplier
- `sales_transactions` - Transaksi penjualan
- `transaction_items` - Detail item per transaksi
- `suppliers` - Data supplier

**Storage:**
- Bucket untuk foto produk (public access)

---

## 📱 Responsive Design

- **Desktop**: Full sidebar navigation, wide tables
- **Tablet**: Collapsible sidebar, adaptive grids
- **Mobile**: Bottom tab navigation, card-based layouts, swipe gestures

---

## ✅ Deliverables

1. Welcome Screen dengan animasi
2. Dashboard dengan 10 stats cards + charts
3. CRUD Kelola Stok dengan multi-unit & foto upload
4. Kargo Masuk tracking dengan floating asset
5. Penjualan dengan FIFO profit calculation
6. Transaksi Harian dengan WhatsApp resi export
7. Laporan periodik dengan CSV export
8. Print invoice feature
9. Manajemen supplier
10. Responsive design untuk semua screen size

