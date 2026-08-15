/**
 * Main Application Orchestrator for Geotag Map Camera
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const videoEl = document.getElementById('cameraVideo');
  const flashEffect = document.getElementById('flashEffect');
  const gridOverlay = document.getElementById('cameraGrid');
  
  // UI Buttons & Controls
  const btnShutter = document.getElementById('btnShutter');
  const btnFlipCamera = document.getElementById('btnFlipCamera');
  const btnTorch = document.getElementById('btnTorch');
  const btnGrid = document.getElementById('btnGrid');
  const btnSettings = document.getElementById('btnSettings');
  const driveStatusBadge = document.getElementById('driveStatusBadge');
  const driveStatusText = document.getElementById('driveStatusText');
  const btnGallery = document.getElementById('btnGallery');
  const galleryBadge = document.getElementById('galleryBadge');
  const galleryThumbImg = document.getElementById('galleryThumbImg');
  const galleryIconFallback = document.getElementById('galleryIconFallback');
  const lensSelectorBar = document.getElementById('lensSelectorBar');

  // Geotag Text Elements
  const geoHeader = document.getElementById('geoHeader');
  const geoAddress1 = document.getElementById('geoAddress1');
  const geoAddress2 = document.getElementById('geoAddress2');
  const geoCoords = document.getElementById('geoCoords');
  const geoTimestamp = document.getElementById('geoTimestamp');
  const geoNoteBtn = document.getElementById('geoNoteBtn');
  const geoNoteText = document.getElementById('geoNoteText');

  // Modals
  const driveSettingsModal = document.getElementById('driveSettingsModal');
  const btnCloseDriveModal = document.getElementById('btnCloseDriveModal');
  const btnCancelDrive = document.getElementById('btnCancelDrive');
  const btnSaveDrive = document.getElementById('btnSaveDrive');
  const tabWebhook = document.getElementById('tabWebhook');
  const tabOAuth = document.getElementById('tabOAuth');
  const sectionWebhook = document.getElementById('sectionWebhook');
  const sectionOAuth = document.getElementById('sectionOAuth');
  const inputWebhookUrl = document.getElementById('inputWebhookUrl');
  const inputClientId = document.getElementById('inputClientId');
  const checkAutoUpload = document.getElementById('checkAutoUpload');
  const btnCopyScript = document.getElementById('btnCopyScript');

  const editNoteModal = document.getElementById('editNoteModal');
  const inputCustomNote = document.getElementById('inputCustomNote');
  const btnCancelNote = document.getElementById('btnCancelNote');
  const btnSaveNote = document.getElementById('btnSaveNote');

  const galleryModal = document.getElementById('galleryModal');
  const btnCloseGalleryModal = document.getElementById('btnCloseGalleryModal');
  const galleryGrid = document.getElementById('galleryGrid');
  const emptyGalleryState = document.getElementById('emptyGalleryState');

  const photoPreviewModal = document.getElementById('photoPreviewModal');
  const btnClosePreviewModal = document.getElementById('btnClosePreviewModal');
  const previewFullImg = document.getElementById('previewFullImg');
  const previewAddress = document.getElementById('previewAddress');
  const previewCoords = document.getElementById('previewCoords');
  const previewTime = document.getElementById('previewTime');
  const btnDownloadSingle = document.getElementById('btnDownloadSingle');
  const btnUploadDriveSingle = document.getElementById('btnUploadDriveSingle');
  const btnDeletePhoto = document.getElementById('btnDeletePhoto');

  // Toast
  const toast = document.getElementById('toast');
  const toastIcon = document.getElementById('toastIcon');
  const toastMessage = document.getElementById('toastMessage');

  // Module Instances
  const camera = new GeotagCamera(videoEl);
  const geotag = new GeotagManager();
  const watermark = new GeotagWatermark();
  const drive = window.googleDriveManager;
  const storage = window.geotagStorage;

  let activePreviewPhoto = null;

  // 1. Initialize Camera
  try {
    await camera.start();
  } catch (err) {
    showToast(err.message, 'error');
  }

  // 2. Initialize Geolocation & Leaflet Mini Map
  geotag.initLeafletMap('leafletMapContainer');
  geotag.startTracking();

  geotag.onUpdate((data) => {
    geoHeader.textContent = data.header;
    geoAddress1.textContent = data.addressLine1;
    geoAddress2.textContent = data.addressLine2;
    geoCoords.textContent = `${data.latStr}, ${data.lngStr}`;
    geoTimestamp.textContent = data.timestampStr;
    geoNoteText.textContent = `Note : ${data.note}`;
  });

  // iOS Safari invalidateSize fix when video plays or window resizes
  videoEl.addEventListener('loadeddata', () => {
    setTimeout(() => {
      if (geotag.leafletMap) geotag.leafletMap.invalidateSize();
    }, 300);
  });
  window.addEventListener('resize', () => {
    if (geotag.leafletMap) geotag.leafletMap.invalidateSize();
  });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      if (geotag.leafletMap) geotag.leafletMap.invalidateSize();
    }, 400);
  });

  // Update Drive Badge Status
  updateDriveStatusUI();

  // Load Gallery Thumbnail & Count
  updateGalleryBadge();

  // ==========================================================================
  // Lens Switcher (0.5x, 1x, 2x, 3x)
  // ==========================================================================
  if (lensSelectorBar) {
    const lensBtns = lensSelectorBar.querySelectorAll('.lens-btn');
    lensBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const zoomVal = parseFloat(btn.getAttribute('data-zoom'));
        lensBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const success = await camera.setZoom(zoomVal);
        if (success) {
          showToast(`Lensa ${zoomVal}x`, 'search');
        } else {
          showToast(`Lensa ${zoomVal}x (Zoom Digital)`, 'search');
        }
      });
    });
  }

  // ==========================================================================
  // Shutter Action (Take Photo)
  // ==========================================================================
  btnShutter.addEventListener('click', async () => {
    try {
      // Flash Animation
      flashEffect.classList.add('flash');
      setTimeout(() => flashEffect.classList.remove('flash'), 150);

      // Capture high-res frame
      const frameCanvas = camera.captureFrame();

      // Apply Geotag Watermark onto canvas
      const watermarkedCanvas = await watermark.applyWatermark(frameCanvas, geotag.locationData);

      const dataUrl = watermarkedCanvas.toDataURL('image/jpeg', 0.95);
      const timestamp = Date.now();
      const filename = `Geotag_${new Date(timestamp).toISOString().slice(0,10)}_${timestamp}.jpg`;

      // A. Save to Device (Trigger Instant Download)
      saveToDevice(dataUrl, filename);

      // B. Save to Local IndexedDB Gallery
      const photoRecord = await storage.savePhoto({
        id: 'photo_' + timestamp,
        timestamp: timestamp,
        dateFormatted: geotag.locationData.timestampStr,
        dataUrl: dataUrl,
        address: `${geotag.locationData.header} - ${geotag.locationData.addressLine1}`,
        lat: geotag.locationData.lat,
        lng: geotag.locationData.lng,
        note: geotag.locationData.note
      });

      updateGalleryBadge();

      showToast('Foto tersimpan di Perangkat!', 'download_done');

      // C. Auto Upload to Google Drive if enabled
      if (drive.isConfigured() && drive.autoUpload) {
        showToast('Mengunggah ke Google Drive...', 'cloud_upload');
        try {
          const res = await drive.uploadPhoto(photoRecord);
          await storage.updateDriveStatus(photoRecord.id, res.fileId);
          updateGalleryBadge();
          showToast('Tersimpan di Perangkat & Google Drive! ☁️', 'cloud_done');
        } catch (driveErr) {
          console.error('Auto Drive Upload Error:', driveErr);
          showToast('Foto tersimpan di HP (Gagal upload Drive: ' + driveErr.message + ')', 'warning');
        }
      }

    } catch (err) {
      console.error('Capture Error:', err);
      showToast('Gagal mengambil foto: ' + err.message, 'error');
    }
  });

  // Save to Device Download Helper
  function saveToDevice(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ==========================================================================
  // Controls Bar Events
  // ==========================================================================

  // Flip Camera
  btnFlipCamera.addEventListener('click', async () => {
    try {
      await camera.toggleCamera();
      showToast(camera.facingMode === 'user' ? 'Kamera Depan' : 'Kamera Belakang', 'cameraswitch');
    } catch (err) {
      showToast('Gagal membalik kamera', 'error');
    }
  });

  // Torch Toggle
  btnTorch.addEventListener('click', async () => {
    const isTorchOn = await camera.toggleTorch();
    btnTorch.classList.toggle('active', isTorchOn);
    btnTorch.querySelector('.material-symbols-outlined').textContent = isTorchOn ? 'flash_on' : 'flash_off';
  });

  // Grid Lines Toggle
  btnGrid.addEventListener('click', () => {
    gridOverlay.classList.toggle('active');
    btnGrid.classList.toggle('active');
  });

  // Drive Settings Button & Status Badge
  btnSettings.addEventListener('click', openDriveModal);
  driveStatusBadge.addEventListener('click', openDriveModal);

  function openDriveModal() {
    inputWebhookUrl.value = drive.webhookUrl;
    inputClientId.value = drive.clientId;
    checkAutoUpload.checked = drive.autoUpload;

    if (drive.mode === 'oauth') {
      switchDriveTab('oauth');
    } else {
      switchDriveTab('webhook');
    }

    driveSettingsModal.classList.add('active');
  }

  btnCloseDriveModal.addEventListener('click', () => driveSettingsModal.classList.remove('active'));
  btnCancelDrive.addEventListener('click', () => driveSettingsModal.classList.remove('active'));

  tabWebhook.addEventListener('click', () => switchDriveTab('webhook'));
  tabOAuth.addEventListener('click', () => switchDriveTab('oauth'));

  function switchDriveTab(mode) {
    if (mode === 'webhook') {
      tabWebhook.classList.add('active');
      tabOAuth.classList.remove('active');
      sectionWebhook.style.display = 'flex';
      sectionOAuth.style.display = 'none';
    } else {
      tabOAuth.classList.add('active');
      tabWebhook.classList.remove('active');
      sectionOAuth.style.display = 'flex';
      sectionWebhook.style.display = 'none';
    }
  }

  btnSaveDrive.addEventListener('click', () => {
    const mode = tabWebhook.classList.contains('active') ? 'webhook' : 'oauth';
    drive.saveSettings(mode, inputWebhookUrl.value, inputClientId.value, checkAutoUpload.checked);
    updateDriveStatusUI();
    driveSettingsModal.classList.remove('active');
    showToast('Pengaturan Google Drive disimpan!', 'check_circle');
  });

  btnCopyScript.addEventListener('click', () => {
    const codeText = document.getElementById('codeScriptSnippet').innerText;
    navigator.clipboard.writeText(codeText);
    btnCopyScript.textContent = 'Tersalin! ✓';
    setTimeout(() => btnCopyScript.textContent = 'Salin Kode', 2000);
  });

  function updateDriveStatusUI() {
    if (drive.isConfigured()) {
      driveStatusBadge.classList.add('connected');
      driveStatusText.textContent = drive.mode === 'webhook' ? 'Drive Webhook Active' : 'Drive OAuth Active';
    } else {
      driveStatusBadge.classList.remove('connected');
      driveStatusText.textContent = 'Drive Offline';
    }
  }

  // ==========================================================================
  // Edit Note Modal
  // ==========================================================================
  geoNoteBtn.addEventListener('click', () => {
    inputCustomNote.value = geotag.locationData.note;
    editNoteModal.classList.add('active');
  });

  btnCancelNote.addEventListener('click', () => editNoteModal.classList.remove('active'));
  btnSaveNote.addEventListener('click', () => {
    geotag.setNote(inputCustomNote.value);
    editNoteModal.classList.remove('active');
    showToast('Catatan diperbarui!', 'edit');
  });

  // ==========================================================================
  // Gallery & Preview Modal
  // ==========================================================================
  btnGallery.addEventListener('click', openGallery);
  btnCloseGalleryModal.addEventListener('click', () => galleryModal.classList.remove('active'));

  async function openGallery() {
    const photos = await storage.getAllPhotos();
    galleryGrid.innerHTML = '';

    if (photos.length === 0) {
      emptyGalleryState.style.display = 'block';
    } else {
      emptyGalleryState.style.display = 'none';
      photos.forEach(photo => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `
          <img src="${photo.dataUrl}" alt="Photo">
          ${photo.uploadedToDrive ? '<div class="drive-uploaded-badge" title="Tersimpan di Google Drive"><span class="material-symbols-outlined" style="font-size: 14px;">cloud_done</span></div>' : ''}
        `;
        item.addEventListener('click', () => openPhotoPreview(photo));
        galleryGrid.appendChild(item);
      });
    }

    galleryModal.classList.add('active');
  }

  async function updateGalleryBadge() {
    const photos = await storage.getAllPhotos();
    if (photos.length > 0) {
      galleryBadge.textContent = photos.length;
      galleryBadge.style.display = 'block';
      galleryThumbImg.src = photos[0].dataUrl;
      galleryThumbImg.style.display = 'block';
      galleryIconFallback.style.display = 'none';
    } else {
      galleryBadge.style.display = 'none';
      galleryThumbImg.style.display = 'none';
      galleryIconFallback.style.display = 'block';
    }
  }

  function openPhotoPreview(photo) {
    activePreviewPhoto = photo;
    previewFullImg.src = photo.dataUrl;
    previewAddress.textContent = photo.address || 'Tanpa Alamat';
    previewCoords.textContent = `Lat ${photo.lat.toFixed(6)}, Long ${photo.lng.toFixed(6)}`;
    previewTime.textContent = photo.dateFormatted;

    photoPreviewModal.classList.add('active');
  }

  btnClosePreviewModal.addEventListener('click', () => photoPreviewModal.classList.remove('active'));

  // Download Single from Preview
  btnDownloadSingle.addEventListener('click', () => {
    if (!activePreviewPhoto) return;
    const filename = `Geotag_${new Date(activePreviewPhoto.timestamp).toISOString().slice(0,10)}_${activePreviewPhoto.timestamp}.jpg`;
    saveToDevice(activePreviewPhoto.dataUrl, filename);
    showToast('Foto diunduh ke HP!', 'download');
  });

  // Upload Single to Drive from Preview
  btnUploadDriveSingle.addEventListener('click', async () => {
    if (!activePreviewPhoto) return;
    if (!drive.isConfigured()) {
      openDriveModal();
      showToast('Konfigurasi Google Drive terlebih dahulu', 'warning');
      return;
    }

    showToast('Mengunggah foto ke Google Drive...', 'cloud_upload');
    try {
      const res = await drive.uploadPhoto(activePreviewPhoto);
      await storage.updateDriveStatus(activePreviewPhoto.id, res.fileId);
      activePreviewPhoto.uploadedToDrive = true;
      updateGalleryBadge();
      openGallery();
      showToast('Foto berhasil diunggah ke Google Drive! ☁️', 'cloud_done');
    } catch (err) {
      showToast('Gagal upload: ' + err.message, 'error');
    }
  });

  // Delete Single Photo
  btnDeletePhoto.addEventListener('click', async () => {
    if (!activePreviewPhoto) return;
    if (confirm('Hapus foto ini dari galeri lokal?')) {
      await storage.deletePhoto(activePreviewPhoto.id);
      photoPreviewModal.classList.remove('active');
      await openGallery();
      await updateGalleryBadge();
      showToast('Foto dihapus', 'delete');
    }
  });

  // Toast Helper
  function showToast(message, iconName = 'info') {
    toastMessage.textContent = message;
    toastIcon.textContent = iconName;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }
});
