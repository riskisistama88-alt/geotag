/**
 * IndexedDB Local Storage Manager for Geotag Camera
 */
class GeotagStorage {
  constructor() {
    this.dbName = 'GeotagCameraDB';
    this.dbVersion = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('photos')) {
          const store = db.createObjectStore('photos', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB Error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async savePhoto(photoData) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['photos'], 'readwrite');
      const store = transaction.objectStore('photos');

      const record = {
        id: photoData.id || 'photo_' + Date.now(),
        timestamp: photoData.timestamp || Date.now(),
        dateFormatted: photoData.dateFormatted || new Date().toLocaleString('id-ID'),
        dataUrl: photoData.dataUrl,
        address: photoData.address || '',
        lat: photoData.lat || 0,
        lng: photoData.lng || 0,
        note: photoData.note || '',
        uploadedToDrive: photoData.uploadedToDrive || false,
        driveFileId: photoData.driveFileId || null
      };

      const request = store.put(record);

      request.onsuccess = () => resolve(record);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async getAllPhotos() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['photos'], 'readonly');
      const store = transaction.objectStore('photos');
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev'); // Latest first
      const results = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = (event) => reject(event.target.error);
    });
  }

  async deletePhoto(id) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['photos'], 'readwrite');
      const store = transaction.objectStore('photos');
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async updateDriveStatus(id, driveFileId) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['photos'], 'readwrite');
      const store = transaction.objectStore('photos');
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const data = getReq.result;
        if (data) {
          data.uploadedToDrive = true;
          data.driveFileId = driveFileId;
          const putReq = store.put(data);
          putReq.onsuccess = () => resolve(data);
          putReq.onerror = (e) => reject(e.target.error);
        } else {
          reject(new Error('Photo not found'));
        }
      };

      getReq.onerror = (e) => reject(e.target.error);
    });
  }
}

window.geotagStorage = new GeotagStorage();
