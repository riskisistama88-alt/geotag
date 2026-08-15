/**
 * High-DPI Watermark Stamping Engine for Canvas
 * Multi-Line Text Wrapping & Dynamic Card Expansion
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
    const maxDim = Math.max(canvas.width, canvas.height);
    const scale = (maxDim / 1600) * 0.82;

    // Overlay Card Base Dimensions
    const padding = Math.round(20 * scale);
    const cardMarginBottom = Math.round(24 * scale);
    const cardMarginLeft = Math.round(24 * scale);
    
    // Scale Map Thumbnail Size
    const mapSize = Math.round(isLandscape ? 225 * scale : 200 * scale);

    const cardWidth = Math.min(canvas.width - (cardMarginLeft * 2), Math.round((isLandscape ? 1080 : 860) * scale));
    const cardX = cardMarginLeft;

    // Calculate dynamic text height required first
    const maxTextWidth = cardWidth - (mapSize + (padding * 2) + Math.round(22 * scale));
    
    // Measure Header Lines
    ctx.font = `bold ${Math.round(30 * scale)}px "Roboto", "Segoe UI", sans-serif`;
    const headerLines = this.calculateLines(ctx, locationData.header || 'Location Unknown', maxTextWidth, 2);
    const headerHeight = headerLines.length * Math.round(38 * scale);

    // Measure Address Line 1 & 2
    ctx.font = `${Math.round(22 * scale)}px "Roboto", "Segoe UI", sans-serif`;
    const addr1Lines = locationData.addressLine1 ? this.calculateLines(ctx, locationData.addressLine1, maxTextWidth, 2) : [];
    const addr1Height = addr1Lines.length * Math.round(28 * scale);

    const addr2Lines = locationData.addressLine2 ? this.calculateLines(ctx, locationData.addressLine2, maxTextWidth, 2) : [];
    const addr2Height = addr2Lines.length * Math.round(28 * scale);

    // Coords, Timestamp, Note
    const coordsHeight = Math.round(28 * scale);
    const timeHeight = Math.round(28 * scale);
    const noteHeight = Math.round(28 * scale);

    const totalTextHeight = headerHeight + addr1Height + addr2Height + coordsHeight + timeHeight + noteHeight + Math.round(14 * scale);
    const cardHeight = Math.max(mapSize + (padding * 2), totalTextHeight + (padding * 2));
    const cardY = canvas.height - cardHeight - cardMarginBottom;

    // 2. Draw Dark Semi-Transparent Card Background
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
    ctx.font = `600 ${Math.round(17 * scale)}px "Roboto", sans-serif`;
    const badgeWidth = ctx.measureText(badgeText).width + (18 * scale);
    const badgeHeight = Math.round(26 * scale);
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
    ctx.fillText(badgeText, badgeX + (9 * scale), badgeY + (badgeHeight / 2));
    ctx.restore();

    // 5. Draw Text Information on Right Side of Map
    const textX = mapX + mapSize + Math.round(20 * scale);
    let textY = cardY + padding + Math.round(4 * scale);

    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'top';

    // A. Header Title (Multi-line wrap up to 2 lines!)
    ctx.font = `bold ${Math.round(30 * scale)}px "Roboto", "Segoe UI", sans-serif`;
    headerLines.forEach(line => {
      ctx.fillText(line, textX, textY);
      textY += Math.round(36 * scale);
    });
    textY += Math.round(4 * scale);

    // B. Address Line 1
    ctx.font = `${Math.round(22 * scale)}px "Roboto", "Segoe UI", sans-serif`;
    ctx.fillStyle = '#E8E8E8';
    addr1Lines.forEach(line => {
      ctx.fillText(line, textX, textY);
      textY += Math.round(28 * scale);
    });

    // C. Address Line 2
    addr2Lines.forEach(line => {
      ctx.fillText(line, textX, textY);
      textY += Math.round(28 * scale);
    });

    // D. Coordinates (Lat, Long)
    ctx.font = `600 ${Math.round(22 * scale)}px "Roboto", "Segoe UI", sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    const coordsText = `${locationData.latStr}, ${locationData.lngStr}`;
    ctx.fillText(coordsText, textX, textY);
    textY += Math.round(28 * scale);

    // E. Timestamp
    ctx.font = `${Math.round(21 * scale)}px "Roboto", "Segoe UI", sans-serif`;
    ctx.fillStyle = '#E0E0E0';
    ctx.fillText(locationData.timestampStr, textX, textY);
    textY += Math.round(28 * scale);

    // F. Note
    ctx.font = `italic ${Math.round(21 * scale)}px "Roboto", "Segoe UI", sans-serif`;
    ctx.fillStyle = '#A8C7FA';
    const noteText = `Note : ${locationData.note}`;
    ctx.fillText(this.truncateText(ctx, noteText, maxTextWidth), textX, textY);

    return canvas;
  }

  /**
   * Helper to split text into lines without harsh truncating
   */
  calculateLines(ctx, text, maxWidth, maxLines = 2) {
    const words = text.split(' ');
    let line = '';
    let lines = [];

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(line.trim());
        line = words[n] + ' ';
        if (lines.length === maxLines - 1) {
          const remaining = words.slice(n).join(' ');
          lines.push(this.truncateText(ctx, remaining, maxWidth));
          line = '';
          break;
        }
      } else {
        line = testLine;
      }
    }
    if (line.trim().length > 0 && lines.length < maxLines) {
      lines.push(line.trim());
    }
    return lines;
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
