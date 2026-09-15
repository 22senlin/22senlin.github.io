import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);

  const crcVal = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crcVal, 8 + len);
  return buf;
}

function generatePNG(width, height, getPixel) {
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = getPixel(x, y);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Header Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type 6 (RGBA)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Forest Teal & Wada Blue theme pixel generator
function forestPixel(x, y, size) {
  const nx = x / size;
  const ny = y / size;
  
  // Background: #004D52 (0, 77, 82)
  let r = 0, g = 77, b = 82, a = 255;
  
  // Rounded corners mask
  const cx = nx - 0.5;
  const cy = ny - 0.5;
  if (Math.abs(cx) > 0.42 && Math.abs(cy) > 0.42) {
    const distSq = (Math.abs(cx) - 0.35) ** 2 + (Math.abs(cy) - 0.35) ** 2;
    if (distSq > 0.01) return [0, 0, 0, 0];
  }
  
  // Tree triangles
  // Main White tree (center)
  const treeY = (ny - 0.15) / 0.65;
  const treeHalfW = (1 - treeY) * 0.4;
  if (treeY >= 0 && treeY <= 1.0 && Math.abs(nx - 0.5) <= treeHalfW) {
    r = 255; g = 255; b = 255;
  }
  // Accent Left tree (#CED19B)
  const lTreeY = (ny - 0.3) / 0.55;
  const lTreeHalfW = (1 - lTreeY) * 0.32;
  if (lTreeY >= 0 && lTreeY <= 1.0 && Math.abs(nx - 0.3) <= lTreeHalfW && r === 0) {
    r = 206; g = 209; b = 155;
  }
  // Accent Right tree (#C8E7E9)
  const rTreeY = (ny - 0.3) / 0.55;
  const rTreeHalfW = (1 - rTreeY) * 0.32;
  if (rTreeY >= 0 && rTreeY <= 1.0 && Math.abs(nx - 0.7) <= rTreeHalfW && r === 0) {
    r = 200; g = 231; b = 233;
  }

  // Bottom ferrofluid drops
  const drop1Dist = Math.hypot(nx - 0.28, ny - 0.85);
  const drop2Dist = Math.hypot(nx - 0.5, ny - 0.88);
  const drop3Dist = Math.hypot(nx - 0.72, ny - 0.85);

  if (drop2Dist < 0.08) { r = 255; g = 255; b = 255; }
  else if (drop1Dist < 0.06) { r = 200; g = 231; b = 233; }
  else if (drop3Dist < 0.06) { r = 206; g = 209; b = 155; }

  return [r, g, b, a];
}

const favicon64 = generatePNG(64, 64, (x, y) => forestPixel(x, y, 64));
const touch180 = generatePNG(180, 180, (x, y) => forestPixel(x, y, 180));

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'favicon.png'), favicon64);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), touch180);

console.log('Successfully generated valid PNG favicons in public directory!');
