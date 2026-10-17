let ocrWorker = null;
let pdfjsLib = null;

export async function initOcr(languages) {
  if (window.Tesseract) {
    try {
      ocrWorker = await Tesseract.createWorker(languages, 1, { logger: () => {} });
      await ocrWorker.setParameters({
        tessedit_pageseg_mode: '3',
        preserve_interword_spaces: '1',
        textord_heavy_nr: '1',
        edges_max_children_per_outline: '40'
      });
    } catch (e) { console.warn('Tesseract init failed:', e); }
  }
  try {
    const pdfModule = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs');
    pdfjsLib = pdfModule;
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
    }
  } catch (e) { console.warn('PDF.js load failed:', e); }
}

function preprocessForOcr(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let scale = 1;
      const minDim = Math.min(img.width, img.height);
      if (minDim < 1500) scale = 1500 / minDim;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;

      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
        d[i] = d[i+1] = d[i+2] = gray;
      }

      const contrast = 1.5;
      const intercept = 128 * (1 - contrast);
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.min(255, Math.max(0, d[i] * contrast + intercept));
        d[i] = d[i+1] = d[i+2] = v;
      }

      const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
      const src = new Uint8ClampedArray(d);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let sum = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * w + (x + kx)) * 4;
              sum += src[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
            }
          }
          const idx = (y * w + x) * 4;
          const val = Math.min(255, Math.max(0, sum));
          d[idx] = d[idx+1] = d[idx+2] = val;
        }
      }

      const threshold = 140;
      for (let i = 0; i < d.length; i += 4) {
        const v = d[i] > threshold ? 255 : 0;
        d[i] = d[i+1] = d[i+2] = v;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });
}

function preprocessChunk(img, sx, sy, sw, sh) {
  return new Promise((resolve) => {
    const scale = 1500 / sw;
    const w = Math.round(sw * scale);
    const h = Math.round(sh * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;

    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
      d[i] = d[i+1] = d[i+2] = gray;
    }

    const contrast = 1.5;
    const intercept = 128 * (1 - contrast);
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.min(255, Math.max(0, d[i] * contrast + intercept));
      d[i] = d[i+1] = d[i+2] = v;
    }

    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    const src = new Uint8ClampedArray(d);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * w + (x + kx)) * 4;
            sum += src[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        const idx = (y * w + x) * 4;
        const val = Math.min(255, Math.max(0, sum));
        d[idx] = d[idx+1] = d[idx+2] = val;
      }
    }

    const threshold = 140;
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i] > threshold ? 255 : 0;
      d[i] = d[i+1] = d[i+2] = v;
    }

    ctx.putImageData(imageData, 0, 0);
    resolve(canvas.toDataURL('image/png'));
  });
}

export async function ocrImage(dataUrl, onProgress) {
  if (!ocrWorker) return '';
  try {
    const img = await loadImage(dataUrl);
    const isLong = img.height > img.width * 2;

    if (!isLong) {
      if (onProgress) onProgress(0, 1, '');
      const processed = await preprocessForOcr(dataUrl);
      if (onProgress) onProgress(0, 1, '预处理完成，识别中...');
      const { data } = await ocrWorker.recognize(processed);
      return data.text.trim();
    }

    const chunkHeight = 1500;
    const chunks = Math.ceil(img.height / chunkHeight);
    let allText = '';

    for (let i = 0; i < chunks; i++) {
      if (onProgress) onProgress(i, chunks, `正在识别 ${i + 1}/${chunks}...`);
      const sy = i * chunkHeight;
      const sh = Math.min(chunkHeight, img.height - sy);
      const processed = await preprocessChunk(img, 0, sy, img.width, sh);
      const { data } = await ocrWorker.recognize(processed);
      const text = data.text.trim();
      if (text) allText += (allText ? '\n' : '') + text;
      if (onProgress) onProgress(i + 1, chunks, allText);
    }

    return allText;
  } catch (e) { console.warn('OCR failed:', e); return ''; }
}

export async function ocrPdf(dataUrl) {
  if (!pdfjsLib || !ocrWorker) return '';
  try {
    const uint8 = await (await fetch(dataUrl)).arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise;
    let allText = '';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const imgData = canvas.toDataURL('image/png');
      const processed = await preprocessForOcr(imgData);
      const { data } = await ocrWorker.recognize(processed);
      allText += data.text.trim() + '\n';
    }
    return allText.trim();
  } catch (e) { console.warn('PDF OCR failed:', e); return ''; }
}

export function readExifOrientation(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  if (view.getUint16(0) !== 0xFFD8) return 1;
  let offset = 2;
  const length = view.byteLength;
  while (offset < length) {
    const marker = view.getUint16(offset);
    if (marker === 0xFFE1) {
      if (offset + 4 > length) return 1;
      const exifStart = offset + 4;
      if (exifStart + 6 > length) return 1;
      if (view.getUint32(exifStart) !== 0x45786966) return 1;
      const tiffStart = exifStart + 6;
      if (tiffStart + 8 > length) return 1;
      const bigEndian = view.getUint16(tiffStart) === 0x4D4D;
      if (view.getUint16(tiffStart + 2, bigEndian) !== 0x002A) return 1;
      const ifdOffset = view.getUint32(tiffStart + 4, bigEndian);
      const ifdStart = tiffStart + ifdOffset;
      if (ifdStart + 2 > length) return 1;
      const numEntries = view.getUint16(ifdStart, bigEndian);
      for (let i = 0; i < numEntries; i++) {
        const entryOffset = ifdStart + 2 + i * 12;
        if (entryOffset + 12 > length) return 1;
        if (view.getUint16(entryOffset, bigEndian) === 0x0112) {
          const val = view.getUint16(entryOffset + 8, bigEndian);
          return val >= 1 && val <= 8 ? val : 1;
        }
      }
      return 1;
    } else if ((marker & 0xFF00) !== 0xFF00) {
      return 1;
    } else {
      offset += 2 + view.getUint16(offset + 2);
    }
  }
  return 1;
}

export function correctImageOrientation(dataUrl, orientation) {
  return new Promise((resolve) => {
    if (!orientation || orientation === 1) { resolve(dataUrl); return; }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const w = img.width, h = img.height;
      if (orientation >= 5 && orientation <= 8) { canvas.width = h; canvas.height = w; }
      else { canvas.width = w; canvas.height = h; }
      switch (orientation) {
        case 2: ctx.transform(-1,0,0,1,w,0); break;
        case 3: ctx.transform(-1,0,0,-1,w,h); break;
        case 4: ctx.transform(1,0,0,-1,0,h); break;
        case 5: ctx.transform(0,1,1,0,0,0); break;
        case 6: ctx.transform(0,1,-1,0,h,0); break;
        case 7: ctx.transform(0,-1,-1,0,h,w); break;
        case 8: ctx.transform(0,-1,1,0,0,w); break;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function createThumbnail(dataUrl, maxSize) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
      else { w = Math.round(w * maxSize / h); h = maxSize; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
