/**
 * Копирует статику (HTML/CSS/JS) в dist/ для деплоя на Render Static Site.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const dist = path.join(root, 'dist');

const skip = new Set(['node_modules', 'dist', 'package.json', 'package-lock.json', 'build.mjs']);

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (skip.has(name)) continue;
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const name of fs.readdirSync(root)) {
  if (skip.has(name)) continue;
  copyRecursive(path.join(root, name), path.join(dist, name));
}

console.log('build: copied static assets to dist/');
