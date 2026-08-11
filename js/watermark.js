/**
 * High-DPI Watermark Stamping Engine for Canvas
 */
class GeotagWatermark {
  constructor() {
    this.pinImage = null;
  }

  /**
   * Stamps the geotag watermark onto the captured camera canvas
   * @param {HTMLCanvasElement} cameraCanvas 
   * @param {Object} locationData 
   * @returns {Promise<HTMLCanvasElement>}
   */
  async applyWatermark(cameraCanvas, locationData) {
    const canvas = document.createElement('canvas');
    canvas.width = cameraCanvas.width;
    canvas.height = cameraCanvas.height;

    const ctx = canvas.getContext('2d');

    // 1. Draw main photo
    ctx.drawImage(cameraCanvas, 0, 0);

    // Dynamic scale factor based on image width (reference width 1920px)
    const scale = canvas.width / 1920;

    // Overlay Card Dimensions
    const padding = 24 * scale;
    const cardMarginBottom = 20 * scale;
    const cardMarginLeft = 20 * scale;
    const cardWidth = Math.min(canvas.width - (cardMarginLeft * 2), 1400 * scale);
    const mapSize = 220 * scale;

    const cardX = cardMarginLeft;
    // Calculate card height dynamically or fixed ~ 260px * scale
    const cardHeight = mapSize + (padding * 2);
    const cardY = canvas.height - cardHeight - cardMarginBottom;

    // 2. Draw Dark Semi-Transparent Card Background
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15 * scale;
    
    // Rounded Card Corners
    const cornerRadius = 16 * scale;
    ctx.beginPath();
    ctx.moveTo(cardX + cornerRadius, cardY);
    ctx.lineTo(cardX + cardWidth - cornerRadius, cardY);
    ctx.quadraticCurveTo(cardX + cardWidth, cardY, cardX + cardWidth, cardY + cornerRadius);
    ctx.lineTo(cardX + cardWidth, cardY + cardHeight - cornerRadius);
    ctx.quadraticCurveTo(cardX + cardWidth, cardY + cardHeight, cardX + cardWidth - cornerRadius, cardY + cardHeight);
    ctx.lineTo(cardX + cornerRadius, cardY + cardHeight);
    ctx.quadraticCurveTo(cardX, cardY + cardHeight, cardX, cardY + cardHeight - cornerRadius);
    ctx.lineTo(cardX, cardY + cornerRadius);
    ctx.quadraticCurveTo(cardX, cardY, cardX + cornerRadius, cardY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. Draw Mini Map Image on Left
    const mapX = cardX + padding;
    const mapY = cardY + padding;

    try {
      const mapCanvas = await this.renderMapCanvas(locationData.lat, locationData.lng, mapSize, mapSize);
      
      // Draw map rounded border frame
      ctx.save();
      ctx.beginPath();
      const mapRadius = 12 * scale;
      ctx.moveTo(mapX + mapRadius, mapY);
      ctx.lineTo(mapX + mapSize - mapRadius, mapY);
      ctx.quadraticCurveTo(mapX + mapSize, mapY, mapX + mapSize, mapY + mapRadius);
      ctx.lineTo(mapX + mapSize, mapY + mapSize - mapRadius);
      ctx.quadraticCurveTo(mapX + mapSize, mapY + mapSize, mapX + mapSize - mapRadius, mapY + mapSize);
      ctx.lineTo(mapX + mapRadius, mapY + mapSize);
      ctx.quadraticCurveTo(mapX, mapY + mapSize, mapX, mapY + mapSize - mapRadius);
      ctx.lineTo(mapX, mapY + mapRadius);
      ctx.quadraticCurveTo(mapX, mapY, mapX + mapRadius, mapY);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(mapCanvas, mapX, mapY, mapSize, mapSize);
      ctx.restore();

      // Border line around map
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.roundRect(mapX, mapY, mapSize, mapSize, 12 * scale);
      ctx.stroke();
      ctx.restore();
    } catch (e) {
      console.warn('Could not draw map on canvas:', e);
      // Fallback gray box
      ctx.fillStyle = '#333333';
      ctx.fillRect(mapX, mapY, mapSize, mapSize);
    }

    // 4. Draw Text Information on Right Side of Map
    const textX = mapX + mapSize + (20 * scale);
    let textY = mapY + (32 * scale);
    const maxTextWidth = cardWidth - (mapSize + (padding * 2) + (20 * scale));

    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'top';

    // A. Header Title with Flag Emoji
    ctx.font = `bold ${Math.round(36 * scale)}px "Roboto", "Segoe UI", sans-serif`;
    const headerText = locationData.header || 'Location Unknown';
    ctx.fillText(this.truncateText(ctx, headerText, maxTextWidth), textX, textY);
    textY += 44 * scale;

    // B. Address Line 1
    ctx.font = `${Math.round(24 * scale)}px "Roboto", "Segoe UI", sans-serif`;
    ctx.fillStyle = '#E0E0E0';
    if (locationData.addressLine1) {
      ctx.fillText(this.truncateText(ctx, locationData.addressLine1, maxTextWidth), textX, textY);
      textY += 32 * scale;
    }

    // C. Address Line 2
    if (locationData.addressLine2) {
      ctx.fillText(this.truncateText(ctx, locationData.addressLine2, maxTextWidth), textX, textY);
      textY += 32 * scale;
    }

    // D. Coordinates (Lat, Long)
    ctx.font = `500 ${Math.round(26 * scale)}px "Roboto", "Segoe UI", sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    const coordsText = `${locationData.latStr}, ${locationData.lngStr}`;
    ctx.fillText(coordsText, textX, textY);
    textY += 34 * scale;

    // E. Timestamp
    ctx.font = `${Math.round(24 * scale)}px "Roboto", "Segoe UI", sans-serif`;
    ctx.fillStyle = '#E0E0E0';
    ctx.fillText(locationData.timestampStr, textX, textY);
    textY += 32 * scale;

    // F. Note
    ctx.font = `italic ${Math.round(24 * scale)}px "Roboto", "Segoe UI", sans-serif`;
    ctx.fillStyle = '#CCCCCC';
    const noteText = `Note : ${locationData.note}`;
    ctx.fillText(this.truncateText(ctx, noteText, maxTextWidth), textX, textY);

    return canvas;
  }

  /**
   * Helper to fetch static map tiles and draw pin marker on canvas
   */
  async renderMapCanvas(lat, lng, width, height) {
    const mapCanvas = document.createElement('canvas');
    mapCanvas.width = width;
    mapCanvas.height = height;
    const ctx = mapCanvas.getContext('2d');

    const zoom = 16;
    // Calculate tile numbers for zoom level 16
    const n = Math.pow(2, zoom);
    const xExact = ((lng + 180) / 360) * n;
    const latRad = (lat * Math.PI) / 180;
    const yExact = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

    const tileX = Math.floor(xExact);
    const tileY = Math.floor(yExact);

    const offsetX = (xExact - tileX) * 256;
    const offsetY = (yExact - tileY) * 256;

    // Draw center tile and surrounding 8 tiles (3x3 grid)
    const centerX = width / 2;
    const centerY = height / 2;

    const tilePromises = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const tx = tileX + dx;
        const ty = tileY + dy;
        const url = `https://a.tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
        
        const posX = centerX - offsetX + (dx * 256);
        const posY = centerY - offsetY + (dy * 256);

        tilePromises.push(this.loadImage(url).then(img => {
          ctx.drawImage(img, posX, posY, 256, 256);
        }).catch(err => {
          // If tile load fails, fill background
          ctx.fillStyle = '#E5E3DF';
          ctx.fillRect(posX, posY, 256, 256);
        }));
      }
    }

    await Promise.all(tilePromises);

    // Draw Blue View Cone & Red Location Marker Pin in center
    const pinX = width / 2;
    const pinY = height / 2;

    // Orientation Blue Cone
    ctx.save();
    ctx.fillStyle = 'rgba(66, 133, 244, 0.35)';
    ctx.beginPath();
    ctx.moveTo(pinX, pinY);
    ctx.arc(pinX, pinY, 60, -Math.PI / 4 - Math.PI / 2, Math.PI / 4 - Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Red Pin Marker
    ctx.save();
    ctx.fillStyle = '#EA4335';
    ctx.strokeStyle = '#B31412';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pinX, pinY - 15, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner White Dot
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(pinX, pinY - 15, 5, 0, Math.PI * 2);
    ctx.fill();

    // Pin Point Triangle
    ctx.fillStyle = '#EA4335';
    ctx.beginPath();
    ctx.moveTo(pinX - 10, pinY - 10);
    ctx.lineTo(pinX + 10, pinY - 10);
    ctx.lineTo(pinX, pinY);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    return mapCanvas;
  }

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  }
}

window.GeotagWatermark = GeotagWatermark;
