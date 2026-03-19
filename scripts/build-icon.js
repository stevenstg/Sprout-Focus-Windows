import { execSync } from 'child_process';
import { mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, '../app/icon.svg');
const outIco = join(__dirname, '../app/icon.ico');
const tmp = join(__dirname, '../tmp-icon');

mkdirSync(tmp, { recursive: true });

// SVG viewBox is 16x16, so density = 96 * targetSize / 16
const sizes = [16, 20, 24, 32, 48, 64, 256];
const tmpFiles = [];

for (const size of sizes) {
  const density = Math.round(96 * size / 16);
  const out = join(tmp, `icon-${size}.png`);
  execSync(
    `magick -background transparent -density ${density} "${svgPath}" -resize ${size}x${size}! PNG32:"${out}"`
  );
  tmpFiles.push(out);
  console.log(`  rendered ${size}x${size}`);
}

execSync(`magick ${tmpFiles.map((f) => `"${f}"`).join(' ')} "${outIco}"`);
console.log('icon.ico written to', outIco);

for (const f of tmpFiles) unlinkSync(f);
