<div align="center">

# MDX Reader

**A Markdown viewer and editor that renders mixed Arabic-English text correctly.**  
Offline · zero runtime dependencies · Windows app + single-file web version

[![Release](https://img.shields.io/github/v/release/reyad-dev/mdx-reader?display_name=tag&sort=semver)](https://github.com/reyad-dev/mdx-reader/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-0078D4?logo=windows)](https://github.com/reyad-dev/mdx-reader/releases/latest)
![Download size](https://img.shields.io/badge/download-~75_MB-blue)

[![Download for Windows](https://img.shields.io/badge/Download-Windows_installer-2563eb?style=for-the-badge&logo=windows)](https://github.com/reyad-dev/mdx-reader/releases/latest/download/MDX-Reader-Setup-1.1.0.exe)
[![Live Demo](https://img.shields.io/badge/Open-Live_Demo-7c3aed?style=for-the-badge&logo=github)](https://reyad-dev.github.io/mdx-reader/)

[العربية](#العربية) · [Features](#features) · [Install](#installation) · [How it works](#how-the-bidi-engine-works)

</div>

## The bidi problem—and the fix

Most Markdown viewers rely on `dir="auto"`. The browser then chooses a block's direction from its **first strong character**. This heading begins with Latin text:

```markdown
# CLAUDE.md — مرجع المشروع الكامل لأي موديل AI
```

So a normal viewer marks the whole heading LTR. The Arabic phrase, punctuation, and inline Latin tokens can then appear in the wrong visual order. The same failure occurs independently in table cells, list items, and quotes.

| Before: first-character direction | MDX Reader: content-aware direction |
|---|---|
| Starts with `C` → the entire heading is LTR, so the mixed text can break | Arabic and Latin letters are counted per block; Arabic ≥ 20% → RTL |
| Inline code and URLs can reorder surrounding punctuation | Inline code, links, and numbers use bidi isolation |
| Arabic comments may influence a code block | Fenced code blocks are always LTR |

MDX Reader applies that logic to every heading, paragraph, table cell, list item, and blockquote—not once for the whole document.

## Screenshots

<!-- Screenshots will be added here after capture:
![Mixed Arabic-English document](docs/screenshots/mixed-arabic-english.png)
![Split editor and preview](docs/screenshots/split-view.png)
![Themes and typography settings](docs/screenshots/themes-settings.png)
-->

Screenshots are being prepared. Try the [live, single-file version](https://reyad-dev.github.io/mdx-reader/) in the meantime.

## Features

| Area | What is included |
|---|---|
| Arabic and bidi | Per-block smart direction, forced RTL/LTR modes, first-character compatibility mode, isolated inline Latin text |
| Markdown | Tables with alignment, task lists, reference links, footnotes, front matter, GitHub callouts, raw HTML |
| Code | Always-LTR fenced blocks and syntax highlighting for JavaScript/TypeScript, Python, SQL, Shell, and JSON |
| Editing | Preview, synchronized split view, editor view, optional autosave, Markdown formatting shortcuts |
| Navigation | Generated outline with scroll tracking and diacritic/hamza-insensitive Arabic search |
| Appearance | Dark, midnight, light, and sepia themes; font family, size, line height, and content-width controls |
| Files and export | Windows `.md` file association, drag and drop, standalone HTML export, print/PDF |
| Runtime | Custom Markdown engine, fully offline, no runtime packages or remote CSS/JavaScript |

## Installation

### 1. Windows installer

[Download `MDX-Reader-Setup-1.1.0.exe`](https://github.com/reyad-dev/mdx-reader/releases/latest/download/MDX-Reader-Setup-1.1.0.exe). The installer can associate `.md`, `.markdown`, `.mdown`, `.mkd`, and `.mdx` files with MDX Reader.

### 2. Portable Windows app

[Download `MDX-Reader-Portable-1.1.0.exe`](https://github.com/reyad-dev/mdx-reader/releases/latest/download/MDX-Reader-Portable-1.1.0.exe) and run it without installation.

### 3. Browser version

Use the [live demo](https://reyad-dev.github.io/mdx-reader/), or download [`MDX-Reader-Standalone.html`](MDX-Reader-Standalone.html) and open it locally. All CSS and JavaScript are inline; no connection is required. Drag a Markdown file onto the window to open it.

### 4. Run from source

```powershell
git clone https://github.com/reyad-dev/mdx-reader.git
cd mdx-reader
npm install
npm start
```

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+O` | Open a file |
| `Ctrl+S` / `Ctrl+Shift+S` | Save / Save as |
| `Ctrl+F` | Search (`Enter` next, `Shift+Enter` previous) |
| `Ctrl+E` | Toggle editor and preview |
| `Ctrl+1` / `Ctrl+2` / `Ctrl+3` | Preview / split / editor |
| `Ctrl+\` | Toggle outline |
| `Ctrl+,` | Settings |
| `Ctrl++` / `Ctrl+-` / `Ctrl+0` | Increase / decrease / reset text size |
| `Ctrl+B` / `Ctrl+I` / `Ctrl+K` | Bold / italic / link in the editor |
| `Ctrl+P` | Print or save as PDF |

## How the bidi engine works

The renderer in [`app/markdown.js`](app/markdown.js) is written from scratch and has no external runtime dependency. `detectDir()` counts Arabic-script and Latin letters inside each block. If Arabic is at least 20% of the counted letters, that block becomes RTL; if it contains no Arabic, it becomes LTR. `dattr()` emits the corresponding `dir` attribute for headings, paragraphs, cells, list items, quotes, and footnotes.

Inline code, links, and numeric spans are isolated with CSS `unicode-bidi: isolate`, preventing an LTR fragment from changing punctuation order in its RTL sentence. Fenced code is always rendered LTR, regardless of comment language. The document-direction selector can override smart detection without changing the interface language.

## Build from source

```powershell
npm install
npm run standalone
npm run dist
```

The Windows build produces both NSIS installer and portable executables in `dist/`.

> [!NOTE]
> On Windows, `electron-builder` may need **Developer Mode** enabled—or an elevated terminal—because its tool archives contain symbolic links. Enable it under **Settings → Privacy & security → For developers** if extraction fails.

## العربية

<div dir="rtl">

### ما هو MDX Reader؟

MDX Reader عارض ومحرر Markdown لويندوز والمتصفح، صُمم لمعالجة النص العربي المختلط بالإنجليزية بصورة صحيحة. يعمل دون إنترنت، ومحرك Markdown فيه مكتوب من الصفر بلا مكتبات وقت تشغيل.

### المشكلة والحل

تعتمد عارضات كثيرة على <code>dir="auto"</code>، فيحدد المتصفح اتجاه العنصر من أول حرف قوي. لذلك يبدأ العنوان <code>CLAUDE.md — مرجع المشروع الكامل لأي موديل AI</code> بحرف إنجليزي ويُعامل كله كعنصر LTR؛ فتضطرب العربية وعلامات الترقيم.

الحل يعمل على ثلاثة مستويات:

1. يحسب المحرك الحروف العربية واللاتينية في كل عنوان وفقرة وخلية جدول وبند قائمة واقتباس. إذا بلغت العربية 20% يصبح العنصر RTL، وإذا لم توجد عربية يصبح LTR.
2. يعزل الكود السطري والروابط والأرقام اتجاهيًا باستخدام <code>unicode-bidi: isolate</code>، فلا تغيّر ترتيب الجملة العربية المحيطة.
3. يثبت اتجاه كتل الكود على LTR دائمًا، حتى مع وجود تعليقات عربية.

### أهم المميزات

- دعم جداول GFM وقوائم المهام والاقتباسات التنبيهية والحواشي والروابط المرجعية وبيانات front matter.
- ثلاثة أوضاع: معاينة، ومقسوم بتحرير ومعاينة متزامنة، وتحرير.
- لغة الواجهة مستقلة عن اتجاه المستند: ذكي، أو RTL، أو LTR، أو حسب أول حرف.
- أربعة ثيمات وفهرس تلقائي وبحث عربي يتجاهل التشكيل والهمزات.
- حفظ تلقائي اختياري، وتصدير HTML مستقل، وطباعة/PDF، وفتح ملفات Markdown بالسحب والإفلات.

### التثبيت والتشغيل

- **المثبت:** [تنزيل نسخة ويندوز](https://github.com/reyad-dev/mdx-reader/releases/latest/download/MDX-Reader-Setup-1.1.0.exe) لربط ملفات Markdown بالتطبيق.
- **المحمولة:** [تنزيل النسخة المحمولة](https://github.com/reyad-dev/mdx-reader/releases/latest/download/MDX-Reader-Portable-1.1.0.exe) وتشغيلها دون تثبيت.
- **المتصفح:** افتح [النسخة الحية](https://reyad-dev.github.io/mdx-reader/) أو نزّل ملف <code>MDX-Reader-Standalone.html</code> وافتحه محليًا.
- **من السورس:** نفّذ <code>npm install</code> ثم <code>npm start</code>. للبناء نفّذ <code>npm run dist</code>.

كل الاختصارات وخيارات البناء موضحة في الأقسام الإنجليزية أعلاه. المساهمات وتقارير الأخطاء مرحّب بها عبر GitHub.

</div>

## Contributing

Bug reports and focused pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change. Please include a minimal Markdown sample for any bidi or rendering issue and do not add runtime dependencies without prior discussion.

## License

MIT © Mohamed Reyad. See [LICENSE](LICENSE).
