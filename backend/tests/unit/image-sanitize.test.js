import JPEG from 'jpeg-js';
import { jpegHasExif, sanitizeImageBuffer } from '../../src/lib/imageSanitize.js';

function makeJpeg({ width = 8, height = 8, r = 200, g = 40, b = 20 } = {}) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return Buffer.from(JPEG.encode({ data, width, height }, 80).data);
}

function withJpegExif(jpeg) {
  const payload = Buffer.concat([Buffer.from('Exif\0\0'), Buffer.alloc(8)]);
  const app1 = Buffer.alloc(4 + payload.length);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  app1.writeUInt16BE(2 + payload.length, 2);
  payload.copy(app1, 4);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

function pngChunk(type, data) {
  const buf = Buffer.alloc(12 + data.length);
  buf.writeUInt32BE(data.length, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  buf.writeUInt32BE(0, 8 + data.length);
  return buf;
}

function makePngWithText() {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const text = Buffer.concat([Buffer.from('Comment\0'), Buffer.from('GPS:55.75,37.62')]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('tEXt', text),
    pngChunk('IDAT', Buffer.from([0])),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeWebpWithExif() {
  const exifPayload = Buffer.from('Exif\0\0GPS');
  const padded = exifPayload.length % 2 === 1 ? Buffer.concat([exifPayload, Buffer.from([0])]) : exifPayload;
  const vp8 = Buffer.from('fakevp8data!!');
  const vp8Padded = vp8.length % 2 === 1 ? Buffer.concat([vp8, Buffer.from([0])]) : vp8;
  const chunks = [];
  const vp8Chunk = Buffer.alloc(8 + vp8Padded.length);
  vp8Chunk.write('VP8 ', 0);
  vp8Chunk.writeUInt32LE(vp8.length, 4);
  vp8Padded.copy(vp8Chunk, 8);
  chunks.push(vp8Chunk);
  const exifChunk = Buffer.alloc(8 + padded.length);
  exifChunk.write('EXIF', 0);
  exifChunk.writeUInt32LE(exifPayload.length, 4);
  padded.copy(exifChunk, 8);
  chunks.push(exifChunk);
  const payload = Buffer.concat(chunks);
  const out = Buffer.alloc(12 + payload.length);
  out.write('RIFF', 0);
  out.writeUInt32LE(4 + payload.length, 4);
  out.write('WEBP', 8);
  payload.copy(out, 12);
  return out;
}

describe('imageSanitize', () => {
  it('strips JPEG EXIF on re-encode', () => {
    const dirty = withJpegExif(makeJpeg());
    expect(jpegHasExif(dirty)).toBe(true);
    const clean = sanitizeImageBuffer(dirty, 'image/jpeg');
    expect(clean.mimeType).toBe('image/jpeg');
    expect(clean.buffer[0]).toBe(0xff);
    expect(clean.buffer[1]).toBe(0xd8);
    expect(jpegHasExif(clean.buffer)).toBe(false);
  });

  it('downsamples JPEG when the long edge exceeds 1920', () => {
    const large = makeJpeg({ width: 2000, height: 10 });
    const clean = sanitizeImageBuffer(large, 'image/jpeg');
    const decoded = JPEG.decode(clean.buffer, { maxMemoryUsageInMB: 32 });
    expect(decoded.width).toBeLessThanOrEqual(1920);
    expect(decoded.height).toBeGreaterThan(0);
  });

  it('drops PNG tEXt metadata', () => {
    const dirty = makePngWithText();
    expect(dirty.includes(Buffer.from('tEXt'))).toBe(true);
    const clean = sanitizeImageBuffer(dirty, 'image/png');
    expect(clean.buffer.includes(Buffer.from('tEXt'))).toBe(false);
    expect(clean.buffer.subarray(0, 8).equals(dirty.subarray(0, 8))).toBe(true);
  });

  it('drops WebP EXIF chunk', () => {
    const dirty = makeWebpWithExif();
    expect(dirty.includes(Buffer.from('EXIF'))).toBe(true);
    const clean = sanitizeImageBuffer(dirty, 'image/webp');
    expect(clean.buffer.includes(Buffer.from('EXIF'))).toBe(false);
    expect(clean.buffer.subarray(8, 12).toString('ascii')).toBe('WEBP');
  });
});
