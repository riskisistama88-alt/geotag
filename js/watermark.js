/**
 * High-DPI Watermark Stamping Engine for Canvas
 * Responsive & Prominent Layout (Scaled 20% smaller for compact elegance)
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

    // 1. Draw main photo frame
    ctx.drawImage(cameraCanvas, 0, 0);

    const isLandscape = canvas.width >= canvas.height;
    // Scale factor reduced 20% for compact elegante watermark size
    const maxDim = Math.max(canvas.width, canvas.height);
    const scale = (maxDim / 1600) * 0.8;

    // Overlay Card Dimensions (20% reduced)
    const padding = Math.round(20 * scale);
    const cardMarginBottom = Math.round(24 * scale);
    const cardMarginLeft = Math.round(24 * scale);
    
    // Scale Map Thumbnail Size
    const mapSize = Math.round(isLandscape ? 225 * scale : 190 * scale);

    const cardWidth = Math.min(canvas.width - (cardMarginLeft * 2), Math.round((isLandscape ? 1020 : 800) * scale));
    const cardHeight = mapSize + (padding * 2);
    const cardX = cardMarginLeft;
    const cardY = canvas.height - cardHeight - cardMarginBottom;

    // 2. Draw Dark Semi-Transparent Card Background (Glassmorphic look)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = Math.round(16 * scale);
    
    const cornerRadius = Math.round(16 * scale);
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

    // Subtle white border stroke
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = Math.round(1.5 * scale);
    ctx.stroke();
    ctx.restore();

    // 3. Draw Mini Map Image on Left
    const mapX = cardX + padding;
    const mapY = cardY + padding;

    try {
      const mapCanvas = await this.renderMapCanvas(locationData.lat, locationData.lng, mapSize, mapSize, scale);
      
      ctx.save();
      ctx.beginPath();
      const mapRadius = Math.round(12 * scale);
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

      // Border frame around map
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = Math.round(2 * scale);
      ctx.beginPath();
      ctx.roundRect(mapX, mapY, mapSize, mapSize, Math.round(12 * scale));
      ctx.stroke();
      ctx.restore();
    } catch (e) {
      console.warn('Could not draw map on canvas:', e);
      ctx.fillStyle = '#262626';
      ctx.fillRect(mapX, mapY, mapSize, mapSize);
    }

    // 4. Draw GPS Map Camera Logo Badge on Top Right of Card
    ctx.save();
    const badgeText = '📷 GPS Map Camera';
    ctx.font = `600 ${Math.round(18 * scale)}px "Roboto", sans-serif`;
    const badgeWidth = ctx.measureText(badgeText).width + (20 * scale);
    const badgeHeight = 28 * scale;
    const badgeX = cardX + cardWidth - badgeWidth - padding;
    const badgeY = cardY + padding;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.2 * scale;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 6 * scale);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, badgeX + (10 * scale), badgeY + (badgeHeight / 2));
    ctx.restore();

    // 5. Draw Text Information on Right Side of Map
    const textX = mapX + mapSize + Math.round(20 * scale);
    let textY = mapY + Math.round(10 * scale);
    const maxTextWidth = cardWidth - (mapSize + (padding * 2) + Math.round(20 * scale));

    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'top';

    // A. Header Title with Flag Emoji (e.g., Central Jakarta,Jakarta,Indonesia 🇮🇩)
    ctx.font = `bold ${Math.round(32 * scale)}px "Roboto", "Segoe UI", sans-serif`;
    const headerText = locationData.header || 'Location Unknown';
    ctx.fillText(this.truncateText(ctx, headerText, maxTextWidth), textX, textY);
    textY += Math.round(40 * scale);

    // B. Address Line 1
    ctx.font = `${Math.round(23 * scale)}px "Roboto", "Segoe UI", sans-serif`;
    ctx.fillStyle = '#E8E8E8';
    if (locationData.addressLine1) {
      ctx.fillText(this.truncateText(ctx, locationData.addressLine1, maxTextWidth), textX, textY);
      textY += Math.round(30 * scale);
    }

    // C. Address Line 2
    if (locationData.addressLine2) {
      ctx.fillText(this.truncateText(ctx, locationData.addressLine2, maxTextWidth), textX, textY);
      textY += Math.round(30 * scale);
    }

    // D. Coordinates (Lat, Long)
    ctx.font = `600 ${Math.round(23 * scale)}px "Roboto", "Segoe UI", sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    const coordsText = `${locationData.latStr}, ${locationData.lngStr}`;
    ctx.fillText(coordsText, textX, textY);
    textY += Math.round(30 * scale);

    // E. Timestamp
    ctx.font = `${Math.round(22 * scale)}px "Roboto", "Segoe UI", sans-serif`;
    ctx.fillStyle = '#E0E0E0';
    ctx.fillText(locationData.timestampStr, textX, textY);
    textY += Math.round(28 * scale);

    // F. Note
    ctx.font = `italic ${Math.round(22 * scale)}px "Roboto", "Segoe UI", sans-serif`;
    ctx.fillStyle = '#A8C7FA';
    const noteText = `Note : ${locationData.note}`;
    ctx.fillText(this.truncateText(ctx, noteText, maxTextWidth), textX, textY);

    return canvas;
  }

  /**
   * Helper to fetch static map tiles and draw pin marker on canvas
   */
  async renderMapCanvas(lat, lng, width, height, scale = 1) {
    const mapCanvas = document.createElement('canvas');
    mapCanvas.width = width;
    mapCanvas.height = height;
    const ctx = mapCanvas.getContext('2d');

    const zoom = 16;
    const n = Math.pow(2, zoom);
    const xExact = ((lng + 180) / 360) * n;
    const latRad = (lat * Math.PI) / 180;
    const yExact = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

    const tileX = Math.floor(xExact);
    const tileY = Math.floor(yExact);

    const offsetX = (xExact - tileX) * 256;
    const offsetY = (yExact - tileY) * 256;

    const centerX = width / 2;
    const centerY = height / 2;

    const tilePromises = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const tx = tileX + dx;
        const ty = tileY + dy;
        const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;
        
        const posX = centerX - offsetX + (dx * 256);
        const posY = centerY - offsetY + (dy * 256);

        tilePromises.push(this.loadImage(url).then(img => {
          ctx.drawImage(img, posX, posY, 256, 256);
        }).catch(err => {
          ctx.fillStyle = '#E5E3DF';
          ctx.fillRect(posX, posY, 256, 256);
        }));
      }
    }

    await Promise.all(tilePromises);

    // Draw Blue View Cone & Red Pin Marker
    const pinX = width / 2;
    const pinY = height / 2;
    const pinScale = width / 200;

    // Blue Orientation Cone
    ctx.save();
    ctx.fillStyle = 'rgba(66, 133, 244, 0.4)';
    ctx.beginPath();
    ctx.moveTo(pinX, pinY);
    ctx.arc(pinX, pinY, 60 * pinScale, -Math.PI / 4 - Math.PI / 2, Math.PI / 4 - Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Red Pin Marker
    ctx.save();
    ctx.fillStyle = '#EA4335';
    ctx.strokeStyle = '#B31412';
    ctx.lineWidth = 2 * pinScale;
    ctx.beginPath();
    ctx.arc(pinX, pinY - (16 * pinScale), 14 * pinScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner White Dot
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(pinX, pinY - (16 * pinScale), 5 * pinScale, 0, Math.PI * 2);
    ctx.fill();

    // Pin Point Triangle
    ctx.fillStyle = '#EA4335';
    ctx.beginPath();
    ctx.moveTo(pinX - (10 * pinScale), pinY - (10 * pinScale));
    ctx.lineTo(pinX + (10 * pinScale), pinY - (10 * pinScale));
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
