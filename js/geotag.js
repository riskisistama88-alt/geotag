/**
 * Geolocation & Reverse Geocoding Manager with Leaflet Mini Map
 */
class GeotagManager {
  constructor() {
    this.currentPosition = null;
    this.locationData = {
      header: 'Mendeteksi Lokasi...',
      addressLine1: 'Mencari sinyal GPS...',
      addressLine2: '',
      lat: 0,
      lng: 0,
      latStr: 'Lat 0.000000',
      lngStr: 'Long 0.000000',
      timestampStr: '',
      note: 'Captured by GPS Map Camera',
      countryCode: 'ID',
      countryFlag: '🇮🇩'
    };
    this.watchId = null;
    this.leafletMap = null;
    this.marker = null;
    this.onLocationUpdateCallbacks = [];
    this.isReverseGeocoding = false;
    this.lastGeocodeTime = 0;
  }

  initLeafletMap(containerId) {
    if (this.leafletMap) return;

    const defaultLat = -6.2088;
    const defaultLng = 106.8456;

    this.leafletMap = L.map(containerId, {
      center: [defaultLat, defaultLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false
    });

    // Esri World Imagery Satellite Tile Layer
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Esri, Maxar, Earthstar Geographics'
    }).addTo(this.leafletMap);

    // Custom red pin marker
    const customIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `<div class="pin-container"><span class="material-symbols-outlined pin-icon">location_on</span><div class="pin-cone"></div></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });

    this.marker = L.marker([defaultLat, defaultLng], { icon: customIcon }).addTo(this.leafletMap);

    // Force Leaflet invalidateSize for iOS Safari initial render
    setTimeout(() => {
      if (this.leafletMap) {
        this.leafletMap.invalidateSize();
      }
    }, 400);
  }

  startTracking() {
    if (!navigator.geolocation) {
      alert('Browser Anda tidak mendukung Layanan Geolocation GPS.');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 3000
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => this.handlePositionUpdate(pos),
      (err) => this.handlePositionError(err),
      options
    );

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePositionUpdate(pos),
      (err) => this.handlePositionError(err),
      options
    );

    setInterval(() => {
      this.updateFormattedTimestamp();
      this.triggerCallbacks();
    }, 1000);
  }

  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  async handlePositionUpdate(position) {
    this.currentPosition = position;
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    this.locationData.lat = lat;
    this.locationData.lng = lng;
    this.locationData.latStr = `Lat ${lat.toFixed(6)}`;
    this.locationData.lngStr = `Long ${lng.toFixed(6)}`;

    // Update map view
    if (this.leafletMap) {
      this.leafletMap.setView([lat, lng], 16);
      if (this.marker) {
        this.marker.setLatLng([lat, lng]);
      }
      this.leafletMap.invalidateSize();
    }

    this.updateFormattedTimestamp();

    const now = Date.now();
    if (now - this.lastGeocodeTime > 5000 && !this.isReverseGeocoding) {
      this.lastGeocodeTime = now;
      await this.reverseGeocode(lat, lng);
    }

    this.triggerCallbacks();
  }

  handlePositionError(error) {
    console.warn('Geolocation warning:', error.message);
    this.locationData.header = 'Lokasi GPS Tidak Aktif';
    this.locationData.addressLine1 = 'Mohon aktifkan GPS & izin lokasi pada perangkat Anda.';
    this.triggerCallbacks();
  }

  updateFormattedTimestamp() {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[now.getDay()];

    const dayStr = String(now.getDate()).padStart(2, '0');
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const yearStr = now.getFullYear();

    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');

    const tzo = -now.getTimezoneOffset();
    const dif = tzo >= 0 ? '+' : '-';
    const tzHours = String(Math.floor(Math.abs(tzo) / 60)).padStart(2, '0');
    const tzMins = String(Math.abs(tzo) % 60).padStart(2, '0');
    const timezoneStr = `GMT${dif}${tzHours}:${tzMins}`;

    this.locationData.timestampStr = `${dayName}, ${dayStr}/${monthStr}/${yearStr} ${hoursStr}:${minutes} ${ampm} ${timezoneStr}`;
  }

  async reverseGeocode(lat, lng) {
    this.isReverseGeocoding = true;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'id,en;q=0.9'
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.address) {
          const addr = data.address;

          const country = addr.country || 'Indonesia';
          const countryCode = (addr.country_code || 'id').toUpperCase();
          const flag = this.getCountryFlagEmoji(countryCode);
          this.locationData.countryCode = countryCode;
          this.locationData.countryFlag = flag;

          const city = addr.city || addr.town || addr.city_district || addr.county || addr.municipality || 'Jakarta';
          const state = addr.state || addr.region || '';
          
          const headerParts = [city, state, country].filter(p => p.length > 0);
          this.locationData.header = `${headerParts.join(', ')} ${flag}`;

          const road = addr.road || addr.pedestrian || addr.suburb || '';
          const subdistrict = addr.village || addr.suburb || addr.neighbourhood || '';
          const district = addr.city_district || addr.district || addr.county || '';
          const postcode = addr.postcode || '';

          let line1Parts = [];
          if (road) line1Parts.push(road);
          if (subdistrict) line1Parts.push(subdistrict);
          if (district) line1Parts.push(district);

          this.locationData.addressLine1 = line1Parts.join(', ') || data.display_name;
          
          let line2Parts = [];
          if (city && !line1Parts.includes(city)) line2Parts.push(city);
          if (postcode) line2Parts.push(postcode);
          if (country) line2Parts.push(country);

          this.locationData.addressLine2 = line2Parts.join(', ');
        }
      }
    } catch (e) {
      console.warn('Reverse geocoding failed:', e);
    } finally {
      this.isReverseGeocoding = false;
    }
  }

  getCountryFlagEmoji(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '🇮🇩';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }

  setNote(newNote) {
    this.locationData.note = newNote || 'Captured by GPS Map Camera';
    this.triggerCallbacks();
  }

  onUpdate(callback) {
    this.onLocationUpdateCallbacks.push(callback);
  }

  triggerCallbacks() {
    this.onLocationUpdateCallbacks.forEach(cb => cb(this.locationData));
  }
}

window.GeotagManager = GeotagManager;
