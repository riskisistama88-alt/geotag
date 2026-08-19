/**
 * WebRTC Camera Controller with Multi-Lens & Zoom Support
 */
class GeotagCamera {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.facingMode = 'environment'; // Default rear camera
    this.isTorchOn = false;
    this.track = null;
    this.capabilities = {};
    this.currentResolution = { width: 1920, height: 1080 };
    this.availableVideoDevices = [];
    this.selectedDeviceId = null;
    this.currentZoom = 1;
    const savedMirror = localStorage.getItem('geotag_front_mirror');
    this.mirrorFront = savedMirror !== null ? savedMirror === 'true' : false; // Default: false (tidak mirror)
  }

  async getDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableVideoDevices = devices.filter(d => d.kind === 'videoinput');
      return this.availableVideoDevices;
    } catch (e) {
      console.warn('Could not enumerate video devices:', e);
      return [];
    }
  }

  async start(deviceId = null) {
    if (this.stream) {
      this.stop();
    }

    const videoConstraints = {
      width: { ideal: this.currentResolution.width },
      height: { ideal: this.currentResolution.height }
    };

    if (deviceId) {
      videoConstraints.deviceId = { exact: deviceId };
      this.selectedDeviceId = deviceId;
    } else {
      videoConstraints.facingMode = { ideal: this.facingMode };
    }

    const constraints = {
      audio: false,
      video: videoConstraints
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await this.video.play();

      this.track = this.stream.getVideoTracks()[0];
      if (this.track && this.track.getCapabilities) {
        this.capabilities = this.track.getCapabilities();
      }

      this.isTorchOn = false;

      // Update mirror styling on video element
      this.updateVideoMirrorClass();

      // Enumerate devices once stream is active (labels will now be available)
      await this.getDevices();

      return true;
    } catch (err) {
      console.error('Camera initialization failed:', err);
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        this.video.srcObject = this.stream;
        await this.video.play();
        this.track = this.stream.getVideoTracks()[0];
        this.updateVideoMirrorClass();
        return true;
      } catch (fallbackErr) {
        throw new Error('Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan.');
      }
    }
  }

  updateVideoMirrorClass() {
    if (this.video) {
      if (this.facingMode === 'user' && this.mirrorFront) {
        this.video.classList.add('mirrored');
      } else {
        this.video.classList.remove('mirrored');
      }
    }
  }

  setFrontMirror(isMirror) {
    this.mirrorFront = !!isMirror;
    localStorage.setItem('geotag_front_mirror', this.mirrorFront ? 'true' : 'false');
    this.updateVideoMirrorClass();
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
      this.video.srcObject = null;
    }
  }

  async toggleCamera() {
    this.facingMode = (this.facingMode === 'environment') ? 'user' : 'environment';
    this.selectedDeviceId = null;
    return await this.start();
  }

  async setZoom(zoomValue) {
    this.currentZoom = zoomValue;
    if (!this.track) return false;

    // Check hardware zoom capability
    if (this.capabilities && this.capabilities.zoom) {
      try {
        const minZoom = this.capabilities.zoom.min || 1;
        const maxZoom = this.capabilities.zoom.max || 5;
        const targetZoom = Math.min(Math.max(zoomValue, minZoom), maxZoom);

        await this.track.applyConstraints({
          advanced: [{ zoom: targetZoom }]
        });
        return true;
      } catch (e) {
        console.warn('Hardware zoom constraint failed:', e);
      }
    }

    // If deviceId switching is available for ultra-wide / telephoto
    if (this.availableVideoDevices.length > 1) {
      let targetDevice = null;
      const rearDevices = this.availableVideoDevices.filter(d => 
        !d.label.toLowerCase().includes('front') && 
        !d.label.toLowerCase().includes('user') &&
        !d.label.toLowerCase().includes('selfie')
      );

      if (zoomValue <= 0.6 && rearDevices.length > 1) {
        // Ultra-wide lens search
        targetDevice = rearDevices.find(d => 
          d.label.toLowerCase().includes('ultra') || 
          d.label.toLowerCase().includes('wide 0') ||
          d.label.toLowerCase().includes('back 1')
        );
      } else if (zoomValue >= 2 && rearDevices.length > 1) {
        // Telephoto lens search
        targetDevice = rearDevices.find(d => 
          d.label.toLowerCase().includes('telephoto') || 
          d.label.toLowerCase().includes('zoom') ||
          d.label.toLowerCase().includes('back 2')
        );
      } else if (rearDevices.length > 0) {
        // Main / Wide lens
        targetDevice = rearDevices[0];
      }

      if (targetDevice && targetDevice.deviceId !== this.selectedDeviceId) {
        await this.start(targetDevice.deviceId);
        return true;
      }
    }

    return false;
  }

  async toggleTorch() {
    if (!this.track) return false;
    
    if (this.capabilities && this.capabilities.torch) {
      try {
        this.isTorchOn = !this.isTorchOn;
        await this.track.applyConstraints({
          advanced: [{ torch: this.isTorchOn }]
        });
        return this.isTorchOn;
      } catch (err) {
        console.warn('Torch constraint error:', err);
        this.isTorchOn = false;
        return false;
      }
    } else {
      alert('Lampu kilat (Flash/Torch) tidak didukung oleh perangkat/kamera ini.');
      return false;
    }
  }

  setResolution(width, height) {
    this.currentResolution = { width, height };
    return this.start(this.selectedDeviceId);
  }

  captureFrame() {
    if (!this.video || !this.video.videoWidth) {
      throw new Error('Kamera belum siap untuk mengambil gambar.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;

    const ctx = canvas.getContext('2d');
    
    // Flip horizontally only if front camera AND mirrorFront is enabled
    if (this.facingMode === 'user' && this.mirrorFront) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
}

window.GeotagCamera = GeotagCamera;
