import JPEG from 'jpeg-js';
import { AppError } from './errors.js';

const MAX_EDGE = 1920;
const JPEG_QUALITY = 85;

function downsample(decoded, maxEdge) {
  const width = decoded.width;
  const height = decoded.height;
  const edge = Math.max(width, height);
  if (edge <= maxEdge) return decoded;
  const scale = maxEdge / edge;
  const nw = Math.max(1, Math.round(width * scale));
  const nh = Math.max(1, Math.round(height * scale));
  const src = decoded.data;
  const out = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y += 1) {
    const sy = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < nw; x += 1) {
      const sx = Math.min(width - 1, Math.floor(x / scale));
      const si = (sy * width + sx) * 4;
      const di = (y * nw + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3] ?? 255;
    }
  }
  return { data: out, width: nw, height: nh };
}

function stripJpegAppSegments(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return buffer;
  const out = [Buffer.from([0xff, 0xd8])];
  let i = 2;
  while (i + 3 < buffer.length) {
    if (buffer[i] !== 0xff) break;
    const marker = buffer[i + 1];
    if (marker === 0xda) {
      out.push(buffer.subarray(i));
      break;
    }
    if (marker === 0xd9) {
      out.push(buffer.subarray(i, i + 2));
      break;
    }
    if (marker === 0x00 || marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      out.push(buffer.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const size = buffer.readUInt16BE(i + 2);
    const end = i + 2 + size;
    if (end > buffer.length) break;
    const isApp = marker >= 0xe1 && marker <= 0xef;
    if (!isApp) out.push(buffer.subarray(i, end));
    i = end;
  }
  return Buffer.concat(out);
}

function stripPngMetadata(buffer) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(sig)) return buffer;
  const drop = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
  const parts = [sig];
  let i = 8;
  while (i + 12 <= buffer.length) {
    const len = buffer.readUInt32BE(i);
    const type = buffer.subarray(i + 4, i + 8).toString('ascii');
    const end = i + 12 + len;
    if (end > buffer.length) break;
    if (!drop.has(type)) parts.push(buffer.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(parts);
}

function stripWebpExif(buffer) {
  if (buffer.length < 12) return buffer;
  if (buffer.subarray(0, 4).toString('ascii') !== 'RIFF') return buffer;
  if (buffer.subarray(8, 12).toString('ascii') !== 'WEBP') return buffer;
  const chunks = [];
  let i = 12;
  while (i + 8 <= buffer.length) {
    const type = buffer.subarray(i, i + 4).toString('ascii');
    const size = buffer.readUInt32LE(i + 4);
    let end = i + 8 + size;
    if (end % 2 === 1) end += 1;
    if (end > buffer.length) break;
    if (type !== 'EXIF' && type !== 'XMP ') chunks.push(buffer.subarray(i, end));
    i = end;
  }
  const payload = Buffer.concat(chunks);
  const out = Buffer.alloc(12 + payload.length);
  Buffer.from('RIFF').copy(out, 0);
  out.writeUInt32LE(4 + payload.length, 4);
  Buffer.from('WEBP').copy(out, 8);
  payload.copy(out, 12);
  return out;
}

function sanitizeJpeg(buffer) {
  try {
    const decoded = JPEG.decode(buffer, { maxMemoryUsageInMB: 64, formatAsRGBA: true });
    const scaled = downsample(decoded, MAX_EDGE);
    const encoded = JPEG.encode(
      { data: scaled.data, width: scaled.width, height: scaled.height },
      JPEG_QUALITY,
    );
    return Buffer.from(encoded.data);
  } catch {
    return stripJpegAppSegments(buffer);
  }
}

/**
 * Снимает EXIF/GPS и служебные чанки, при необходимости уменьшает JPEG.
 * @param {Buffer} buffer
 * @param {string} mimeType
 */
export function sanitizeImageBuffer(buffer, mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw new AppError(400, 'Пустой файл', 'BAD_REQUEST');
  }
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return { buffer: sanitizeJpeg(buffer), mimeType: 'image/jpeg', ext: 'jpg' };
  }
  if (mime === 'image/png') {
    return { buffer: stripPngMetadata(buffer), mimeType: 'image/png', ext: 'png' };
  }
  if (mime === 'image/webp') {
    return { buffer: stripWebpExif(buffer), mimeType: 'image/webp', ext: 'webp' };
  }
  return { buffer, mimeType: mime, ext: 'bin' };
}

/** После magic-bytes: JPEG/PNG/WebP чистим, GIF/PDF оставляем. */
export function sanitizeUploadedImage(buffer, mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/png' || mime === 'image/webp') {
    const clean = sanitizeImageBuffer(buffer, mime);
    return {
      buffer: clean.buffer,
      mimeType: clean.mimeType,
      ext: clean.ext,
      sizeBytes: clean.buffer.length,
    };
  }
  return { buffer, mimeType: mime, sizeBytes: buffer.length };
}

export function jpegHasExif(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 6) return false;
  let i = 2;
  while (i + 4 < buffer.length) {
    if (buffer[i] !== 0xff) break;
    const marker = buffer[i + 1];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0xe1) {
      const size = buffer.readUInt16BE(i + 2);
      const payload = buffer.subarray(i + 4, i + 2 + size);
      if (payload.toString('ascii', 0, 4) === 'Exif') return true;
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      i += 2;
      continue;
    }
    if (i + 3 >= buffer.length) break;
    i += 2 + buffer.readUInt16BE(i + 2);
  }
  return false;
}
