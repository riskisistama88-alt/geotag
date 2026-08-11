/**
 * Google Drive Integration Manager
 * Supports:
 * 1. Google Apps Script Webhook Endpoint (Easy 1-step setup)
 * 2. Direct OAuth 2.0 GIS Client ID (Google Drive API v3)
 */
class GoogleDriveManager {
  constructor() {
    this.webhookUrl = localStorage.getItem('geotag_drive_webhook') || '';
    this.clientId = localStorage.getItem('geotag_drive_client_id') || '';
    this.autoUpload = localStorage.getItem('geotag_drive_auto_upload') === 'true';
    this.mode = localStorage.getItem('geotag_drive_mode') || 'webhook'; // 'webhook' or 'oauth'
    this.accessToken = null;
    this.tokenClient = null;
  }

  saveSettings(mode, webhookUrl, clientId, autoUpload) {
    this.mode = mode;
    this.webhookUrl = webhookUrl.trim();
    this.clientId = clientId.trim();
    this.autoUpload = autoUpload;

    localStorage.setItem('geotag_drive_mode', this.mode);
    localStorage.setItem('geotag_drive_webhook', this.webhookUrl);
    localStorage.setItem('geotag_drive_client_id', this.clientId);
    localStorage.setItem('geotag_drive_auto_upload', this.autoUpload ? 'true' : 'false');
  }

  isConfigured() {
    if (this.mode === 'webhook') {
      return !!this.webhookUrl;
    } else {
      return !!this.clientId;
    }
  }

  async uploadPhoto(photoRecord) {
    if (!this.isConfigured()) {
      throw new Error('Google Drive belum dikonfigurasi. Buka Pengaturan Google Drive untuk menghubungkannya.');
    }

    const fileName = `Geotag_${new Date(photoRecord.timestamp).toISOString().replace(/[:.]/g, '-')}.jpg`;

    if (this.mode === 'webhook') {
      return await this.uploadViaWebhook(photoRecord.dataUrl, fileName, photoRecord.address, photoRecord.note);
    } else {
      return await this.uploadViaOAuth(photoRecord.dataUrl, fileName, photoRecord.address);
    }
  }

  /**
   * Upload using Google Apps Script Webhook
   */
  async uploadViaWebhook(base64DataUrl, fileName, address, note) {
    // Remove header data:image/jpeg;base64,
    const base64 = base64DataUrl.split(',')[1];

    const payload = {
      filename: fileName,
      mimeType: 'image/jpeg',
      base64: base64,
      address: address,
      note: note,
      folderName: 'Geotag Map Camera'
    };

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP Error status ${response.status}`);
      }

      const resText = await response.text();
      let resJson = {};
      try {
        resJson = JSON.parse(resText);
      } catch (e) {
        resJson = { status: 'success', raw: resText };
      }

      if (resJson.status === 'error') {
        throw new Error(resJson.message || 'Gagal menyimpan file ke Google Drive via Webhook.');
      }

      return {
        success: true,
        fileId: resJson.fileId || resJson.id || 'webhook_success',
        fileUrl: resJson.fileUrl || resJson.url || null
      };
    } catch (err) {
      console.error('Webhook Upload error:', err);
      throw new Error('Gagal upload ke Google Drive: ' + err.message);
    }
  }

  /**
   * Direct OAuth 2.0 GIS upload to Google Drive API v3
   */
  async uploadViaOAuth(base64DataUrl, fileName, address) {
    if (!this.accessToken) {
      await this.requestAccessToken();
    }

    const base64 = base64DataUrl.split(',')[1];
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });

    // Metadata
    const metadata = {
      name: fileName,
      mimeType: 'image/jpeg',
      description: `Geotag Photo captured at ${address}`
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: form
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, clear token and retry once
        this.accessToken = null;
        return await this.uploadViaOAuth(base64DataUrl, fileName, address);
      }
      throw new Error(`Google Drive API error: ${response.statusText}`);
    }

    const file = await response.json();
    return {
      success: true,
      fileId: file.id,
      fileUrl: `https://drive.google.com/file/d/${file.id}/view`
    };
  }

  requestAccessToken() {
    return new Promise((resolve, reject) => {
      if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        return reject(new Error('Google Identity Library belum dimuat di browser. Check internet connection.'));
      }

      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (tokenResponse) => {
          if (tokenResponse.error) {
            return reject(new Error(tokenResponse.error_description || tokenResponse.error));
          }
          this.accessToken = tokenResponse.access_token;
          resolve(this.accessToken);
        }
      });

      this.tokenClient.requestAccessToken();
    });
  }
}

window.googleDriveManager = new GoogleDriveManager();
