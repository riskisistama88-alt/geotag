# 📍 Geotag Map Camera Web App

A modern, responsive, high-performance HTML5/JavaScript Web Application for taking Geotagged photos with real-time GPS location watermarks, mini-map preview, address reverse geocoding, and dual saving capabilities (Local Device & Google Drive).

Built with **Material Design 3 (MD3)** aesthetics.

![Geotag Camera](https://raw.githubusercontent.com/leaflet/leaflet/main/src/images/logo.png)

## 🌟 Key Features

- **📷 WebRTC Live Camera**: Rear/front camera switching, torch/flash toggle, and 3x3 composition grid overlay.
- **📍 Real-Time GPS Geotagging**: GPS location tracking via HTML5 Geolocation API + OpenStreetMap Nominatim reverse geocoding + Leaflet.js mini map integration.
- **🎨 High-DPI Watermark Stamping Engine**: Burns map snapshot, location title, country flag emoji 🇮🇩, street address, lat/long coordinates, date/time/timezone, and editable custom notes onto high-res JPEG output.
- **💾 Dual Storage System**:
  - **Local Device**: Instant download to phone/PC Download folder.
  - **Google Drive Sync**: Auto-upload or manual upload via 1-click Google Apps Script Webhook or Google OAuth 2.0 GIS.
  - **IndexedDB Local Gallery**: Offline gallery storage for review, re-download, or Drive re-upload.

---

## 🚀 Live Demo & Deployment

Deployable instantly via **GitHub Pages**:
1. Push this repository to GitHub.
2. Go to **Settings > Pages**.
3. Under **Branch**, select `main` (or `master`) / `(root)` and click **Save**.
4. Access your live web camera app at `https://<your-username>.github.io/<repository-name>/`!

---

## 🛠️ Installation & Local Setup

1. Clone or download this repository:
   ```bash
   git clone https://github.com/<your-username>/geotag.git
   ```
2. Open `index.html` directly in your web browser (Chrome, Safari, Edge, Mobile Chrome) or serve via local web server (Laragon, Apache, Live Server, `npx http-server`).
3. Grant Camera and Location permissions when prompted by your browser.

---

## ☁️ Google Drive Webhook Setup (1 Minute)

To automatically save captured geotag photos to Google Drive:
1. Open [Google Apps Script](https://script.google.com/) and create a **New Project**.
2. Paste the following script:
   ```javascript
   function doPost(e) {
     try {
       var data = JSON.parse(e.postData.contents);
       var folderName = data.folderName || "Geotag Map Camera";
       var folders = DriveApp.getFoldersByName(folderName);
       var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
       
       var decoded = Utilities.base64Decode(data.base64);
       var blob = Utilities.newBlob(decoded, data.mimeType || "image/jpeg", data.filename);
       var file = folder.createFile(blob);
       file.setDescription("Alamat: " + data.address + "\nCatatan: " + data.note);
       
       return ContentService.createTextOutput(JSON.stringify({
         status: "success",
         fileId: file.getId(),
         fileUrl: file.getUrl()
       })).setMimeType(ContentService.MimeType.JSON);
     } catch(err) {
       return ContentService.createTextOutput(JSON.stringify({
         status: "error",
         message: err.toString()
       })).setMimeType(ContentService.MimeType.JSON);
     }
   }
   ```
3. Click **Deploy > New Deployment > Web App**.
4. Set **Execute as: Me** and **Who has access: Anyone**.
5. Copy the Webhook URL and paste it in the **Google Drive Settings** inside the app ⚙️.

---

## 📄 License
MIT License - Free to use and modify.
