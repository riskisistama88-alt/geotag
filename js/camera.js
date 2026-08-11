/**
 * WebRTC Camera Controller
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
  }

  async start() {
    if (this.stream) {
      this.stop();
    }

    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: this.facingMode },
        width: { ideal: this.currentResolution.width },
        height: { ideal: this.currentResolution.height }
      }
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
      return true;
    } catch (err) {
      console.error('Camera initialization failed:', err);
      // Fallback to basic constraints if high resolution failed
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        this.video.srcObject = this.stream;
        await this.video.play();
        this.track = this.stream.getVideoTracks()[0];
        return true;
      } catch (fallbackErr) {
        throw new Error('Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan.');
      }
    }
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
    return await this.start();
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
    return this.start();
  }

  captureFrame() {
    if (!this.video || !this.video.videoWidth) {
      throw new Error('Kamera belum siap untuk mengambil gambar.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;

    const ctx = canvas.getContext('2d');
    
    // Flip horizontally if front camera
    if (this.facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
}

window.GeotagCamera = GeotagCamera;
