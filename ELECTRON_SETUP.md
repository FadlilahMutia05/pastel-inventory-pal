# Setup Electron Desktop App

## Langkah-langkah Setup

### 1. Export ke GitHub
Klik tombol "Export to GitHub" di Lovable untuk mendapatkan source code.

### 2. Clone Repository
```bash
git clone <your-repo-url>
cd <project-folder>
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Install Electron Dependencies
```bash
npm install --save-dev electron electron-builder electron-updater concurrently cross-env wait-on
```

### 5. Update package.json
Tambahkan konfigurasi berikut ke `package.json`:

```json
{
  "main": "electron/main.js",
  "author": "Your Name",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "electron:dev": "concurrently \"cross-env BROWSER=none npm run dev\" \"wait-on http://localhost:8080 && cross-env NODE_ENV=development electron .\"",
    "electron:build": "npm run build && electron-builder",
    "electron:build:win": "npm run build && electron-builder --win",
    "electron:build:mac": "npm run build && electron-builder --mac",
    "electron:build:linux": "npm run build && electron-builder --linux"
  }
}
```

### 6. Buat Icon Aplikasi
Untuk hasil terbaik, siapkan icon dalam berbagai format:
- `public/favicon.ico` - untuk Windows (256x256 px)
- `build/icon.icns` - untuk macOS
- `build/icons/` - folder berisi PNG untuk Linux (16x16, 32x32, 48x48, 64x64, 128x128, 256x256, 512x512)

Anda bisa menggunakan tool seperti [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder):
```bash
npx electron-icon-builder --input=./original-icon.png --output=./build
```

### 7. Development Mode
```bash
npm run electron:dev
```
Ini akan menjalankan Vite dev server dan Electron secara bersamaan.

### 8. Build Aplikasi

**Windows:**
```bash
npm run electron:build:win
```
Hasil: `release/Sistem Inventory-x.x.x-x64.exe`

**macOS:**
```bash
npm run electron:build:mac
```
Hasil: `release/Sistem Inventory-x.x.x-arm64.dmg`

**Linux:**
```bash
npm run electron:build:linux
```
Hasil: `release/Sistem Inventory-x.x.x-x64.AppImage`

## Auto-Updater Setup

### GitHub Releases
1. Buat repository di GitHub
2. Update `electron-builder.json`:
   ```json
   "publish": {
     "provider": "github",
     "owner": "your-github-username",
     "repo": "your-repo-name"
   }
   ```

3. Generate GitHub Personal Access Token:
   - Pergi ke GitHub Settings → Developer Settings → Personal Access Tokens
   - Buat token dengan scope `repo`
   - Set environment variable: `GH_TOKEN=your-token`

4. Publish release:
   ```bash
   GH_TOKEN=your-token npm run electron:build -- --publish always
   ```

### Update Flow
1. User membuka aplikasi
2. Aplikasi cek update otomatis setelah 3 detik
3. Jika ada update, akan muncul notifikasi
4. Update didownload di background
5. Setelah selesai, user bisa restart untuk install

## Struktur Folder
```
project/
├── electron/
│   ├── main.js         # Main process
│   └── preload.js      # Preload script
├── build/
│   ├── icon.icns       # macOS icon
│   └── icons/          # Linux icons
├── public/
│   └── favicon.ico     # Windows icon
├── release/            # Build output
├── electron-builder.json
└── package.json
```

## Troubleshooting

### Windows Code Signing (Opsional)
Untuk menghilangkan warning "Unknown Publisher":
1. Dapatkan code signing certificate
2. Tambahkan ke electron-builder.json:
   ```json
   "win": {
     "certificateFile": "./cert.pfx",
     "certificatePassword": "your-password"
   }
   ```

### macOS Notarization (Opsional)
Untuk distribusi di luar App Store:
1. Daftar Apple Developer Program
2. Tambahkan notarization config ke electron-builder.json

## Catatan Penting
- Build Windows di Windows untuk hasil terbaik
- Build macOS hanya bisa di macOS
- Linux bisa di-build di Linux atau dengan Docker
