/**
 * Копирует статику (HTML/CSS/JS) в dist/ для деплоя на Render Static Site.
 * JS и CSS файлы минифицируются через esbuild.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { transform } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const dist = path.join(root, 'dist');

const skip = new Set(['node_modules', 'dist', 'package.json', 'package-lock.json', 'build.mjs']);

const MINIFY_EXTS = new Set(['.js', '.css']);

let minifiedCount = 0;
let copiedCount = 0;

async function processFile(src, dest) {
  const ext = path.extname(src).toLowerCase();

  if (MINIFY_EXTS.has(ext)) {
    const code = fs.readFileSync(src, 'utf8');
    try {
      const result = await transform(code, {
        loader: ext === '.css' ? 'css' : 'js',
        minify: true,
        target: 'es2020',
      });
      fs.writeFileSync(dest, result.code);
      minifiedCount++;
      return;
    } catch {
      // fallback to plain copy on minification failure
    }
  }

  fs.copyFileSync(src, dest);
  copiedCount++;
}

async function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (skip.has(name)) continue;
      await copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    await processFile(src, dest);
  }
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const name of fs.readdirSync(root)) {
  if (skip.has(name)) continue;
  await copyRecursive(path.join(root, name), path.join(dist, name));
}

console.log(`build: ${minifiedCount} files minified, ${copiedCount} files copied → dist/`);
