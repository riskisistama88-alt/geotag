/**
 * Geolocation & Reverse Geocoding Manager with Leaflet Mini Map
 * Enhanced with Indonesian Geographic Validation & Multi-Provider Fallback
 */
class GeotagManager {
  constructor() {
    this.currentPosition = null;
    this.isManualOverride = false;
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
    this.manualData = null;
    this.watchId = null;
    this.leafletMap = null;
    this.marker = null;
    this.onLocationUpdateCallbacks = [];
    this.isReverseGeocoding = false;
    this.lastGeocodeTime = 0;
    this.lastGeocodedCoords = { lat: 0, lng: 0 };
  }

  initLeafletMap(containerId) {
    if (this.leafletMap) return;

    // Default center (Indonesia archipelago center)
    const defaultLat = -2.5489;
    const defaultLng = 118.0149;

    this.leafletMap = L.map(containerId, {
      center: [defaultLat, defaultLng],
      zoom: 15,
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

    // If user moved significantly (>500m), automatically resume live reverse geocoding for the new location
    const distFromLastGeocode = Math.hypot(lat - this.lastGeocodedCoords.lat, lng - this.lastGeocodedCoords.lng);
    if (this.isManualOverride && distFromLastGeocode > 0.005) {
      this.isManualOverride = false;
      this.manualData = null;
    }

    // Trigger reverse geocoding if not manually overridden and coords changed
    if (!this.isManualOverride) {
      const now = Date.now();
      if ((now - this.lastGeocodeTime > 4000 || distFromLastGeocode > 0.0005) && !this.isReverseGeocoding) {
        this.lastGeocodeTime = now;
        this.lastGeocodedCoords = { lat, lng };
        await this.reverseGeocode(lat, lng);
      }
    } else if (this.manualData) {
      // Re-apply manual override values while at the same spot
      this.locationData.header = this.manualData.header;
      this.locationData.addressLine1 = this.manualData.addressLine1;
      this.locationData.addressLine2 = this.manualData.addressLine2;
      if (this.manualData.note) this.locationData.note = this.manualData.note;
    }

    this.triggerCallbacks();
  }

  handlePositionError(error) {
    console.warn('Geolocation warning:', error.message);
    if (!this.isManualOverride) {
      this.locationData.header = 'Lokasi GPS Tidak Aktif';
      this.locationData.addressLine1 = 'Mohon aktifkan GPS & izin lokasi pada perangkat Anda.';
    }
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

  /**
   * Multi-provider dynamic reverse geocoding
   * Seamlessly resolves real road name and postal code for any new location
   */
  async reverseGeocode(lat, lng) {
    if (this.isManualOverride) return;
    this.isReverseGeocoding = true;

    try {
      let nomData = null;
      let bdcData = null;

      // 1. Fetch OpenStreetMap Nominatim (High-res street & building level)
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        const nomRes = await fetch(nomUrl, {
          headers: {
            'Accept-Language': 'id,en;q=0.9'
          }
        });
        if (nomRes.ok) {
          nomData = await nomRes.json();
        }
      } catch (err) {
        console.warn('Nominatim reverse geocode fetch failed:', err);
      }

      // 2. Fetch BigDataCloud (Official administrative boundary & postal code engine)
      try {
        const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`;
        const bdcRes = await fetch(bdcUrl);
        if (bdcRes.ok) {
          bdcData = await bdcRes.json();
        }
      } catch (bdcErr) {
        console.warn('BigDataCloud reverse geocode fetch failed:', bdcErr);
      }

      // 3. Combine both sources intelligently for maximum accuracy at any location
      this.combineAndApplyLocationData(nomData, bdcData, lat, lng);

    } catch (e) {
      console.warn('Reverse geocoding error:', e);
    } finally {
      this.isReverseGeocoding = false;
    }
  }

  /**
   * Intelligently combines Nominatim & BigDataCloud to produce
   * the exact live street name, administrative division, and authentic postal code
   */
  combineAndApplyLocationData(nomData, bdcData, lat, lng) {
    const nomAddr = (nomData && nomData.address) ? nomData.address : {};
    
    // Country & Flag
    const country = nomAddr.country || (bdcData && bdcData.countryName) || 'Indonesia';
    const countryCode = ((nomAddr.country_code || (bdcData && bdcData.countryCode)) || 'id').toUpperCase();
    const flag = this.getCountryFlagEmoji(countryCode);
    this.locationData.countryCode = countryCode;
    this.locationData.countryFlag = flag;

    // Province / State
    let state = nomAddr.state || nomAddr.region || (bdcData && bdcData.principalSubdivision) || '';

    // City / Regency / Kabupaten / Kota
    let city = nomAddr.county || nomAddr.city || nomAddr.town || nomAddr.municipality || (bdcData && bdcData.city) || '';

    // District / Kecamatan
    let district = nomAddr.city_district || nomAddr.district || nomAddr.suburb || (bdcData && bdcData.locality) || '';

    // Subdistrict / Village / Kelurahan / Desa
    let subdistrict = nomAddr.village || nomAddr.neighbourhood || nomAddr.quarter || '';

    // Street / Road Name (Dynamic from live OSM)
    let road = nomAddr.road || nomAddr.pedestrian || nomAddr.footway || '';

    // Postal Code (Dynamic from live GPS coordinates)
    let postcode = nomAddr.postcode || (bdcData && bdcData.postcode) || '';

    // =========================================================================
    // Smart Regional Postcode & Road Validation
    // =========================================================================
    const isOutsideJakarta = !(lat >= -6.4 && lat <= -5.9 && lng >= 106.6 && lng <= 107.1) &&
                             !state.toLowerCase().includes('jakarta');

    // Filter out misplaced Jakarta postcodes (10xxx-14xxx) when physically outside Jakarta
    if (isOutsideJakarta && postcode && (postcode.startsWith('10') || postcode.startsWith('11') || postcode.startsWith('12') || postcode.startsWith('13') || postcode.startsWith('14'))) {
      postcode = (bdcData && bdcData.postcode && !bdcData.postcode.startsWith('1')) ? bdcData.postcode : '';
    }

    // Filter out erroneous Jakarta road tags if an OSM node in remote islands was mis-tagged
    const lowerRoad = road.toLowerCase();
    const jakartaStreets = [
      'wahid hasyim', 'kh wahid hasyim', 'kyai haji wahid hasyim'
    ];
    if (isOutsideJakarta && jakartaStreets.some(st => lowerRoad.includes(st))) {
      road = '';
    }

    // Deduplicate names
    if (city.toLowerCase() === district.toLowerCase()) district = '';
    if (district.toLowerCase() === subdistrict.toLowerCase()) subdistrict = '';
    if (subdistrict.toLowerCase() === road.toLowerCase()) road = '';

    // 1. Build Header: [Kabupaten/Kota], [Provinsi], [Negara] 🇮🇩
    const headerParts = [];
    if (city) headerParts.push(city);
    if (state && !city.toLowerCase().includes(state.toLowerCase())) headerParts.push(state);
    if (country && !headerParts.includes(country)) headerParts.push(country);
    this.locationData.header = `${headerParts.join(', ')} ${flag}`;

    // 2. Build Address Line 1: [Nama Jalan], [Desa/Kelurahan], [Kecamatan]
    const line1Parts = [];
    if (road) line1Parts.push(road);
    if (subdistrict && !line1Parts.includes(subdistrict)) line1Parts.push(subdistrict);
    if (district && !line1Parts.includes(district) && !city.includes(district)) line1Parts.push(district);
    if (line1Parts.length === 0 && city) line1Parts.push(city);

    this.locationData.addressLine1 = line1Parts.join(', ') || (nomData && nomData.display_name ? nomData.display_name.split(',')[0] : 'Lokasi Terdeteksi');

    // 3. Build Address Line 2: [Kabupaten/Kota], [Provinsi] [Kode Pos Asli], [Negara]
    const line2Parts = [];
    if (city && !this.locationData.addressLine1.includes(city)) line2Parts.push(city);
    if (state && !this.locationData.addressLine1.includes(state)) {
      if (postcode) {
        line2Parts.push(`${state} ${postcode}`);
      } else {
        line2Parts.push(state);
      }
    } else if (postcode) {
      line2Parts.push(postcode);
    }
    if (country) line2Parts.push(country);

    this.locationData.addressLine2 = line2Parts.join(', ');
  }

  getCountryFlagEmoji(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '🇮🇩';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }

  /**
   * Set custom manual address & note override
   */
  setManualAddress({ header, addressLine1, addressLine2, note }) {
    this.isManualOverride = true;
    this.manualData = {
      header: header || this.locationData.header,
      addressLine1: addressLine1 || this.locationData.addressLine1,
      addressLine2: addressLine2 || this.locationData.addressLine2,
      note: note || this.locationData.note
    };

    this.locationData.header = this.manualData.header;
    this.locationData.addressLine1 = this.manualData.addressLine1;
    this.locationData.addressLine2 = this.manualData.addressLine2;
    if (this.manualData.note) this.locationData.note = this.manualData.note;

    this.triggerCallbacks();
  }

  /**
   * Reset manual override and restore live GPS reverse geocoding
   */
  resetManualOverride() {
    this.isManualOverride = false;
    this.manualData = null;
    this.lastGeocodeTime = 0;
    if (this.currentPosition) {
      this.handlePositionUpdate(this.currentPosition);
    }
  }

  setNote(newNote) {
    this.locationData.note = newNote || 'Captured by GPS Map Camera';
    if (this.isManualOverride && this.manualData) {
      this.manualData.note = this.locationData.note;
    }
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
