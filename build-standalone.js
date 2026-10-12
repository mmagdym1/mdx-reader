/* يبني نسختين HTML مستقلتين تمامًا: نسخة محلية ونسخة GitHub Pages */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'app');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
const md = fs.readFileSync(path.join(dir, 'markdown.js'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');

// دالة بدل نص عادي: تمنع تفسير $& و $' و $1 داخل المحتوى المحقون
function inject(src, needle, content) {
  if (src.indexOf(needle) === -1) throw new Error('placeholder not found: ' + needle);
  return src.replace(needle, function () { return content; });
}

let out = html;
out = inject(out, '<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>');
out = inject(out, '<script src="markdown.js"></script>', '<script>\n' + md + '\n</script>');
out = inject(out, '<script src="app.js"></script>', '<script>\n' + js + '\n</script>');

const targets = [
  path.join(__dirname, 'MDX-Reader-Standalone.html'),
  path.join(__dirname, 'docs', 'index.html')
];

fs.mkdirSync(path.join(__dirname, 'docs'), { recursive: true });
targets.forEach(function (target) {
  fs.writeFileSync(target, out, 'utf8');
  console.log('OK ->', target, (out.length / 1024).toFixed(1) + ' KB');
});
