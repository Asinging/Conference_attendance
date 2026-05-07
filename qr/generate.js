import QRCode from 'qrcode';
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.argv[2];
if (!url) {
  console.error('Usage: node generate.js <check-in-url>');
  console.error('Example: node generate.js https://checkin.example.com/checkin');
  console.error('         node generate.js "https://checkin.example.com/checkin?day=1"');
  process.exit(1);
}

const outPath = resolve(__dirname, 'event-qr.png');

await QRCode.toFile(outPath, url, {
  width: 1200,
  margin: 2,
  errorCorrectionLevel: 'H',
  color: { dark: '#15151a', light: '#ffffff' }
});

console.log(`QR code written to ${outPath}`);
console.log(`Encoded URL: ${url}`);
console.log('Open print.html in a browser to print a styled poster.');
