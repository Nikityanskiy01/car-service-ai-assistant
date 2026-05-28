import fs from 'fs';

function patch(file, prefix, count) {
  let html = fs.readFileSync(file, 'utf8');
  for (let i = 1; i <= count; i += 1) {
    html = html.replace(
      /src="https:\/\/images\.unsplash\.com[^"]+"/,
      `src="/assets/placeholders/${prefix}-${String(i).padStart(2, '0')}.svg"`,
    );
  }
  fs.writeFileSync(file, html);
}

patch('frontend/gallery.html', 'gallery', 8);
patch('frontend/works.html', 'works', 6);
console.log('patched gallery + works');
