import JPEG from 'jpeg-js';
import { PNG } from 'pngjs';
import { jpegHasExif, sanitizeImageBuffer } from '../../src/lib/imageSanitize.js';
import { isInlineSafeImage } from '../../src/lib/fileMagic.js';

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

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}

function pngChunk(type, data) {
  const buf = Buffer.alloc(12 + data.length);
  buf.writeUInt32BE(data.length, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  buf.writeUInt32BE(crc32(buf.subarray(4, 8 + data.length)), 8 + data.length);
  return buf;
}

function makePngWithText() {
  const png = new PNG({ width: 1, height: 1 });
  png.data[0] = 200;
  png.data[1] = 40;
  png.data[2] = 20;
  png.data[3] = 255;
  const clean = PNG.sync.write(png);
  const text = Buffer.concat([Buffer.from('Comment\0'), Buffer.from('GPS:55.75,37.62')]);
  const insert = pngChunk('tEXt', text);
  const iend = clean.lastIndexOf(Buffer.from('IEND'));
  const at = iend - 4;
  return Buffer.concat([clean.subarray(0, at), insert, clean.subarray(at)]);
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

  it('re-encodes PNG and drops tEXt metadata', () => {
    const dirty = makePngWithText();
    expect(dirty.includes(Buffer.from('tEXt'))).toBe(true);
    const clean = sanitizeImageBuffer(dirty, 'image/png');
    expect(clean.buffer.includes(Buffer.from('tEXt'))).toBe(false);
    expect(clean.buffer.includes(Buffer.from('GPS:'))).toBe(false);
    expect(clean.buffer.subarray(0, 8).equals(dirty.subarray(0, 8))).toBe(true);
    expect(PNG.sync.read(clean.buffer).width).toBe(1);
  });

  it('drops WebP EXIF chunk', () => {
    const dirty = makeWebpWithExif();
    expect(dirty.includes(Buffer.from('EXIF'))).toBe(true);
    const clean = sanitizeImageBuffer(dirty, 'image/webp');
    expect(clean.buffer.includes(Buffer.from('EXIF'))).toBe(false);
    expect(clean.buffer.subarray(8, 12).toString('ascii')).toBe('WEBP');
  });

  it('does not inline GIF', () => {
    expect(isInlineSafeImage('image/gif')).toBe(false);
    expect(isInlineSafeImage('image/jpeg')).toBe(true);
  });
});
