/* ==========================================================================
   MDX Reader — منطق التطبيق
   يعمل داخل Electron (مع فتح/حفظ حقيقي) أو داخل أي متصفح (وضع احتياطي)
   ========================================================================== */
(function () {
  'use strict';

  var HAS_NATIVE = typeof window.mdxNative !== 'undefined';
  var N = window.mdxNative || null;

  /* ------------------------------ الترجمات ------------------------------- */
  var I18N = {
    ar: {
      open: 'فتح', save: 'حفظ', saveAs: 'حفظ باسم',
      viewPreview: 'معاينة', viewSplit: 'مقسوم', viewEditor: 'تحرير',
      toc: 'الفهرس', outline: 'محتويات المستند',
      searchPh: 'بحث في المستند…',
      dirSmart: '🧠 ذكي — عربي = RTL', dirRtl: '→ فرض من اليمين لليسار',
      dirLtr: '← فرض من اليسار لليمين', dirAuto: '↔ حسب أول حرف',
      thDark: '🌙 داكن', thMid: '🌌 ليلي', thLight: '☀️ فاتح', thSepia: '📜 سيبيا',
      noFile: 'لا يوجد ملف مفتوح',
      words: 'كلمات', chars: 'حروف', lines: 'أسطر', readTime: 'وقت القراءة',
      minute: 'د',
      welcomeTitle: 'عارض ومحرر Markdown بدعم عربي كامل',
      welcomeText: 'افتح ملف <b>.md</b> أو اسحبه وأفلته هنا. النص العربي والإنجليزي المختلط يُعرض بشكل صحيح تلقائيًا.',
      editorPh: 'اكتب هنا بالعربي أو English بحرية…',
      dropHere: 'أفلت ملف .md هنا',
      settings: 'الإعدادات', settingsSub: 'كل الإعدادات تُحفظ تلقائيًا',
      fontFamily: 'خط العرض', fontFamilyHint: 'اختر خطًا مثبتًا على جهازك',
      fontSize: 'حجم الخط', lineHeight: 'تباعد الأسطر', contentWidth: 'عرض النص',
      syncScroll: 'تزامن التمرير في الوضع المقسوم',
      autoSave: 'حفظ تلقائي', autoSaveHint: 'يحفظ الملف بعد ثانيتين من آخر تعديل',
      exportHtml: 'تصدير HTML', reset: 'استعادة الافتراضي', done: 'تم',
      saved: 'تم الحفظ ✓', copied: 'تم النسخ ✓', copyBtn: 'نسخ',
      noResults: 'لا نتائج', of: 'من',
      errOpen: 'تعذّر فتح الملف', errSave: 'تعذّر الحفظ',
      unsaved: 'يوجد تعديلات غير محفوظة. هل تريد المتابعة؟',
      exported: 'تم التصدير ✓', untitled: 'مستند-جديد'
    },
    en: {
      open: 'Open', save: 'Save', saveAs: 'Save As',
      viewPreview: 'Preview', viewSplit: 'Split', viewEditor: 'Edit',
      toc: 'Outline', outline: 'Table of contents',
      searchPh: 'Search document…',
      dirSmart: '🧠 Smart — Arabic = RTL', dirRtl: '→ Force right to left',
      dirLtr: '← Force left to right', dirAuto: '↔ By first character',
      thDark: '🌙 Dark', thMid: '🌌 Midnight', thLight: '☀️ Light', thSepia: '📜 Sepia',
      noFile: 'No file open',
      words: 'Words', chars: 'Chars', lines: 'Lines', readTime: 'Read time',
      minute: 'm',
      welcomeTitle: 'Markdown viewer & editor with full Arabic support',
      welcomeText: 'Open a <b>.md</b> file or drop it here. Mixed Arabic/English renders correctly, automatically.',
      editorPh: 'Type here in English or بالعربي…',
      dropHere: 'Drop a .md file here',
      settings: 'Settings', settingsSub: 'Everything is saved automatically',
      fontFamily: 'Display font', fontFamilyHint: 'Pick a font installed on your machine',
      fontSize: 'Font size', lineHeight: 'Line height', contentWidth: 'Content width',
      syncScroll: 'Sync scrolling in split view',
      autoSave: 'Auto-save', autoSaveHint: 'Saves 2 seconds after the last edit',
      exportHtml: 'Export HTML', reset: 'Reset to defaults', done: 'Done',
      saved: 'Saved ✓', copied: 'Copied ✓', copyBtn: 'Copy',
      noResults: 'No results', of: 'of',
      errOpen: 'Could not open file', errSave: 'Could not save',
      unsaved: 'You have unsaved changes. Continue?',
      exported: 'Exported ✓', untitled: 'untitled'
    }
  };

  /* ------------------------------ الحالة --------------------------------- */
  var DEFAULTS = {
    uiLang: 'ar', theme: 'dark', dir: 'smart', view: 'preview', toc: true,
    fontFamily: '"Segoe UI","IBM Plex Sans Arabic","Noto Sans Arabic",Tahoma,sans-serif',
    fontSize: 17, lineHeight: 2, contentWidth: 900,
    syncScroll: true, autoSave: false
  };
  var S = load();
  var state = {
    path: null, name: null, text: '', dirty: false, pendingClose: false,
    fileHandle: null, hits: [], hitIndex: -1, lastRenderedText: null
  };

  var SETTINGS_VERSION = 2;

  function load() {
    try {
      var raw = localStorage.getItem('mdx.settings');
      var s = Object.assign({}, DEFAULTS, raw ? JSON.parse(raw) : {});
      // ترقية: الوضع القديم "auto" كان بيعتمد على أول حرف ويكسر الأسطر المختلطة
      if ((s._v || 1) < 2) {
        if (s.dir === 'auto') s.dir = 'smart';
        s._v = SETTINGS_VERSION;
      }
      return s;
    } catch (e) { return Object.assign({}, DEFAULTS, { _v: SETTINGS_VERSION }); }
  }
  function save() {
    try { localStorage.setItem('mdx.settings', JSON.stringify(S)); } catch (e) {}
  }
  function t(key) { return (I18N[S.uiLang] || I18N.ar)[key] || key; }

  /* ------------------------------ اختصارات ------------------------------- */
  var $ = function (id) { return document.getElementById(id); };
  var el = {
    app: $('app'), main: $('main'), toc: $('toc'), tocList: $('tocList'),
    editor: $('editor'), preview: $('preview'), welcome: $('welcome'),
    paneEditor: $('paneEditor'), panePreview: $('panePreview'), panes: $('panes'),
    fileName: $('fileName'), filePath: $('filePath'), pathbar: $('pathbar'),
    search: $('search'), searchCount: $('searchCount'),
    toast: $('toast'), dropzone: $('dropzone'),
    settingsBack: $('settingsBack'), filePicker: $('filePicker'),
    stWords: $('stWords'), stChars: $('stChars'), stLines: $('stLines'),
    stRead: $('stRead'), stMode: $('stMode'), stSaved: $('stSaved')
  };

  /* ============================= تطبيق الإعدادات ========================== */

  function applyUiLang() {
    var lang = S.uiLang;
    document.documentElement.lang = lang;
    // اتجاه الواجهة يتبع لغة الواجهة
    document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';

    document.querySelectorAll('[data-i18n]').forEach(function (n) {
      var k = n.getAttribute('data-i18n');
      var v = (I18N[lang] || {})[k];
      if (v !== undefined) n.innerHTML = v;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (n) {
      var k = n.getAttribute('data-i18n-ph');
      var v = (I18N[lang] || {})[k];
      if (v !== undefined) n.setAttribute('placeholder', v);
    });
    if (!state.path) el.fileName.textContent = t('noFile');
    $('uiLang').value = lang;
    updateStats();
  }

  function applyDir() {
    // اتجاه محتوى المستند (مستقل تمامًا عن لغة الواجهة)
    var d = S.dir;
    if (d === 'smart' || d === 'auto') {
      var det = state.docDir || window.MDX.detectDir(state.text.slice(0, 8000));
      d = (det === 'auto') ? 'rtl' : det;
    }
    el.preview.setAttribute('dir', d);
    el.editor.setAttribute('dir', S.dir === 'auto' ? 'auto' : d);
    el.tocList.setAttribute('dir', d);
    $('dirSel').value = S.dir;
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', S.theme);
    $('themeSel').value = S.theme;
  }

  function applyTypography() {
    var r = document.documentElement.style;
    r.setProperty('--ar-font', S.fontFamily);
    r.setProperty('--body-size', S.fontSize + 'px');
    r.setProperty('--line-height', String(S.lineHeight));
    r.setProperty('--content-width', S.contentWidth + 'px');
    $('fontSel').value = S.fontFamily;
    $('fontSize').value = S.fontSize; $('fsVal').textContent = S.fontSize;
    $('lineHeight').value = S.lineHeight; $('lhVal').textContent = Number(S.lineHeight).toFixed(1);
    $('contentWidth').value = S.contentWidth; $('cwVal').textContent = S.contentWidth;
    $('syncScroll').checked = !!S.syncScroll;
    $('autoSave').checked = !!S.autoSave;
  }

  function applyView() {
    el.panes.classList.remove('split-only-preview', 'split-only-editor');
    if (S.view === 'preview') el.panes.classList.add('split-only-preview');
    else if (S.view === 'editor') el.panes.classList.add('split-only-editor');
    document.querySelectorAll('#viewSeg .btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.view === S.view);
    });
    el.stMode.textContent = t('view' + S.view.charAt(0).toUpperCase() + S.view.slice(1));
  }

  function applyToc() {
    el.main.classList.toggle('toc-hidden', !S.toc);
    $('btnToc').classList.toggle('active', !!S.toc);
  }

  function applyAll() {
    applyUiLang(); applyTheme(); applyTypography(); applyView(); applyToc(); applyDir();
  }

  /* ================================ العرض ================================ */

  var renderTimer = null;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 120);
  }

  function render() {
    var src = state.text;
    if (!src.trim()) {
      el.preview.innerHTML = '';
      el.preview.appendChild(el.welcome);
      el.welcome.style.display = '';
      el.tocList.innerHTML = '';
      updateStats();
      return;
    }
    var res = window.MDX.render(src, { dir: S.dir });
    el.preview.innerHTML = res.html;
    state.docDir = res.docDir;
    buildToc(res.toc);
    applyDir();
    wireCodeCopy();
    wireLinks();
    updateStats();
    if (el.search.value) runSearch(el.search.value, false);
  }

  function buildToc(toc) {
    if (!toc || !toc.length) {
      el.tocList.innerHTML = '<div style="padding:8px 10px;color:var(--fg-3);font-size:12.5px">—</div>';
      return;
    }
    var html = '';
    toc.forEach(function (h) {
      var hd = (S.dir === 'rtl' || S.dir === 'ltr') ? S.dir : (h.dir || 'auto');
      html += '<a class="lvl-' + h.level + '" href="#' + h.id + '" data-id="' + h.id + '" dir="' + hd + '" title="' +
        window.MDX.escape(h.text) + '">' + window.MDX.escape(h.text) + '</a>';
    });
    el.tocList.innerHTML = html;
    el.tocList.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.getElementById(a.dataset.id);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function wireCodeCopy() {
    el.preview.querySelectorAll('[data-copy]').forEach(function (b) {
      b.textContent = t('copyBtn');
      b.addEventListener('click', function () {
        var code = b.closest('.md-codeblock').querySelector('code');
        var txt = code ? code.innerText : '';
        navigator.clipboard.writeText(txt).then(function () { toast(t('copied')); });
      });
    });
  }

  function wireLinks() {
    el.preview.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (href.charAt(0) === '#') {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var target = document.getElementById(href.slice(1));
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } else if (/^(https?|mailto):/i.test(href)) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          if (HAS_NATIVE) N.openExternal(href);
          else window.open(href, '_blank', 'noopener');
        });
      }
    });
  }

  /* ------------------------------ الإحصائيات ----------------------------- */
  function updateStats() {
    var txt = state.text;
    var words = (txt.match(/[؀-ۿ\w'’]+/g) || []).length;
    el.stWords.textContent = words.toLocaleString(S.uiLang === 'ar' ? 'ar-EG' : 'en-US');
    el.stChars.textContent = txt.length.toLocaleString(S.uiLang === 'ar' ? 'ar-EG' : 'en-US');
    el.stLines.textContent = (txt ? txt.split('\n').length : 0).toLocaleString(S.uiLang === 'ar' ? 'ar-EG' : 'en-US');
    el.stRead.textContent = Math.max(1, Math.round(words / 200)) + ' ' + t('minute');
  }

  /* -------------------------- تتبّع العنوان النشط ------------------------ */
  function setupScrollSpy() {
    el.panePreview.addEventListener('scroll', function () {
      var heads = el.preview.querySelectorAll('.md-h');
      var top = el.panePreview.getBoundingClientRect().top;
      var active = null;
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].getBoundingClientRect().top - top < 90) active = heads[i];
        else break;
      }
      el.tocList.querySelectorAll('a').forEach(function (a) {
        a.classList.toggle('active', active && a.dataset.id === active.id);
      });
      if (active) {
        var cur = el.tocList.querySelector('a.active');
        if (cur && cur.scrollIntoViewIfNeeded) cur.scrollIntoViewIfNeeded(false);
      }
      syncFrom('preview');
    }, { passive: true });

    el.paneEditor.addEventListener('scroll', function () { syncFrom('editor'); }, { passive: true });
  }

  var syncing = false;
  function syncFrom(who) {
    if (!S.syncScroll || S.view !== 'split' || syncing) return;
    syncing = true;
    var a = who === 'editor' ? el.paneEditor : el.panePreview;
    var b = who === 'editor' ? el.panePreview : el.paneEditor;
    var ratio = a.scrollTop / Math.max(1, a.scrollHeight - a.clientHeight);
    b.scrollTop = ratio * Math.max(0, b.scrollHeight - b.clientHeight);
    requestAnimationFrame(function () { syncing = false; });
  }

  /* ================================ البحث ================================ */

  function clearSearch() {
    el.preview.querySelectorAll('.search-hit').forEach(function (n) {
      var p = n.parentNode;
      p.replaceChild(document.createTextNode(n.textContent), n);
      p.normalize();
    });
    state.hits = []; state.hitIndex = -1;
    el.searchCount.textContent = '';
  }

  function runSearch(q, jump) {
    clearSearch();
    q = (q || '').trim();
    if (q.length < 1) return;

    var walker = document.createTreeWalker(el.preview, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (n.parentElement.closest('.md-codebar, script, style')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);

    var needle = norm(q);
    nodes.forEach(function (node) {
      var hay = norm(node.nodeValue);
      var idx = hay.indexOf(needle), from = 0;
      if (idx === -1) return;
      var frag = document.createDocumentFragment();
      var text = node.nodeValue;
      while (idx !== -1) {
        frag.appendChild(document.createTextNode(text.slice(from, idx)));
        var mk = document.createElement('span');
        mk.className = 'search-hit';
        mk.textContent = text.slice(idx, idx + q.length);
        frag.appendChild(mk);
        from = idx + q.length;
        idx = hay.indexOf(needle, from);
      }
      frag.appendChild(document.createTextNode(text.slice(from)));
      node.parentNode.replaceChild(frag, node);
    });

    state.hits = Array.prototype.slice.call(el.preview.querySelectorAll('.search-hit'));
    if (!state.hits.length) { el.searchCount.textContent = t('noResults'); return; }
    state.hitIndex = 0;
    if (jump !== false) focusHit(0); else updateHitLabel();
  }

  // تطبيع عربي: يتجاهل التشكيل والهمزات وشكل الألف والتاء المربوطة
  function norm(s) {
    return s
      .replace(/[ً-ْٰـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[ؤ]/g, 'و')
      .replace(/[ئ]/g, 'ي')
      .toLowerCase();
  }

  function updateHitLabel() {
    el.searchCount.textContent = (state.hitIndex + 1) + ' ' + t('of') + ' ' + state.hits.length;
  }

  function focusHit(i) {
    if (!state.hits.length) return;
    state.hits.forEach(function (h) { h.classList.remove('current'); });
    state.hitIndex = ((i % state.hits.length) + state.hits.length) % state.hits.length;
    var h = state.hits[state.hitIndex];
    h.classList.add('current');
    h.scrollIntoView({ behavior: 'smooth', block: 'center' });
    updateHitLabel();
  }

  /* =============================== الملفات =============================== */

  function setDoc(text, path, name) {
    state.text = text;
    state.path = path || null;
    state.name = name || (path ? path.split(/[\\/]/).pop() : null);
    el.editor.value = text;
    el.fileName.textContent = state.name || t('noFile');
    el.filePath.textContent = path || '';
    setDirty(false);
    el.welcome.style.display = 'none';
    if (HAS_NATIVE && state.name) N.setTitle(state.name);
    render();
    el.panePreview.scrollTop = 0;
    el.paneEditor.scrollTop = 0;
  }

  function setDirty(v) {
    state.dirty = v;
    el.pathbar.classList.toggle('is-dirty', v);
    if (HAS_NATIVE) N.setDirty(v);
  }

  function markDirty() {
    setDirty(true);
    el.stSaved.textContent = '';
    if (S.autoSave && state.path) scheduleAutoSave();
  }

  var autoSaveTimer = null;
  function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(function () { doSave(true); }, 2000);
  }

  async function doOpen() {
    if (state.dirty && !confirm(t('unsaved'))) return;
    if (HAS_NATIVE) {
      var r = await N.openFile();
      if (r && r.ok) setDoc(r.content, r.path);
      else if (r && r.error) toast(t('errOpen'));
      return;
    }
    if (window.showOpenFilePicker) {
      try {
        var [h] = await window.showOpenFilePicker({
          types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.mkd', '.mdx', '.txt'] } }]
        });
        var f = await h.getFile();
        state.fileHandle = h;
        setDoc(await f.text(), f.name, f.name);
      } catch (e) { /* ألغى المستخدم */ }
      return;
    }
    el.filePicker.click();
  }

  async function doSave(silent) {
    if (!state.path && !state.fileHandle) return doSaveAs();
    if (HAS_NATIVE) {
      var r = await N.saveFile(state.path, state.text);
      if (r && r.ok) afterSave(silent);
      else { state.pendingClose = false; toast(t('errSave')); }
      return;
    }
    if (state.fileHandle) {
      try {
        var w = await state.fileHandle.createWritable();
        await w.write(state.text); await w.close();
        afterSave(silent);
      } catch (e) { state.pendingClose = false; toast(t('errSave')); }
      return;
    }
    doSaveAs();
  }

  async function doSaveAs() {
    var suggested = state.name || (t('untitled') + '.md');
    if (HAS_NATIVE) {
      var r = await N.saveFileAs(suggested, state.text);
      if (r && r.ok) {
        state.path = r.path; state.name = r.path.split(/[\\/]/).pop();
        el.fileName.textContent = state.name; el.filePath.textContent = r.path;
        N.setTitle(state.name); afterSave();
      } else {
        state.pendingClose = false;   // ألغى الحفظ ⇒ ألغِ الإغلاق كمان
      }
      return;
    }
    if (window.showSaveFilePicker) {
      try {
        var h = await window.showSaveFilePicker({
          suggestedName: suggested,
          types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }]
        });
        state.fileHandle = h; state.name = h.name;
        el.fileName.textContent = h.name;
        var w = await h.createWritable(); await w.write(state.text); await w.close();
        afterSave();
      } catch (e) {}
      return;
    }
    download(suggested, state.text, 'text/markdown;charset=utf-8');
    afterSave();
  }

  function afterSave(silent) {
    setDirty(false);
    el.stSaved.textContent = t('saved');
    el.stSaved.className = 'sb-item ok';
    if (!silent) toast(t('saved'));
    setTimeout(function () { el.stSaved.textContent = ''; }, 4000);
    // لو الحفظ كان جزء من "احفظ ثم اغلق"
    if (state.pendingClose && HAS_NATIVE) {
      state.pendingClose = false;
      N.closeNow();
    }
  }

  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }

  /* --------------------------- تصدير HTML مستقل -------------------------- */
  async function exportHtml() {
    var res = window.MDX.render(state.text);
    var css = '';
    // نسخة مستقلة: التنسيقات مضمّنة داخل <style>
    document.querySelectorAll('style').forEach(function (s) { css += s.textContent + '\n'; });
    if (!css.trim()) {
      try {
        var links = document.querySelectorAll('link[rel=stylesheet]');
        for (var i = 0; i < links.length; i++) {
          var r = await fetch(links[i].href); css += await r.text();
        }
      } catch (e) {}
    }
    if (!css.trim()) {
      // ملاذ أخير: اقرأ القواعد من ورقة الأنماط المُحمّلة
      try {
        for (var j = 0; j < document.styleSheets.length; j++) {
          var rules = document.styleSheets[j].cssRules || [];
          for (var k = 0; k < rules.length; k++) css += rules[k].cssText + '\n';
        }
      } catch (e) {}
    }
    var dir = el.preview.getAttribute('dir') || 'rtl';
    var doc = '<!DOCTYPE html>\n<html lang="ar" dir="' + dir + '" data-theme="' + S.theme + '">\n<head>\n' +
      '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
      '<title>' + window.MDX.escape(state.name || 'document') + '</title>\n<style>\n' + css +
      '\nhtml,body{overflow:auto;height:auto}\n' +
      'body{--ar-font:' + S.fontFamily + ';--body-size:' + S.fontSize + 'px;--line-height:' + S.lineHeight +
      ';--content-width:' + S.contentWidth + 'px;padding:0;background:var(--bg);color:var(--fg)}\n' +
      '</style>\n</head>\n<body>\n<div class="md-body" dir="' + dir + '">\n' + res.html + '\n</div>\n</body>\n</html>';

    var name = (state.name || 'document').replace(/\.[^.]+$/, '') + '.html';
    if (HAS_NATIVE) {
      var r2 = await N.saveFileAs(name, doc);
      if (r2 && r2.ok) toast(t('exported'));
    } else {
      download(name, doc, 'text/html;charset=utf-8');
      toast(t('exported'));
    }
  }

  /* ============================ مساعدات المحرر =========================== */
  function wrapSelection(before, after, placeholder) {
    var ta = el.editor;
    var s = ta.selectionStart, e = ta.selectionEnd;
    var sel = ta.value.slice(s, e) || (placeholder || '');
    var v = ta.value.slice(0, s) + before + sel + after + ta.value.slice(e);
    ta.value = v;
    ta.focus();
    ta.selectionStart = s + before.length;
    ta.selectionEnd = s + before.length + sel.length;
    state.text = v; markDirty(); scheduleRender();
  }

  /* ============================== الأحداث ================================ */

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(el.toast._t);
    el.toast._t = setTimeout(function () { el.toast.classList.remove('show'); }, 1800);
  }

  function bind() {
    $('btnOpen').addEventListener('click', doOpen);
    $('btnSave').addEventListener('click', function () { doSave(); });
    $('btnSaveAs').addEventListener('click', doSaveAs);
    $('btnPrint').addEventListener('click', function () { window.print(); });
    $('btnExportHtml').addEventListener('click', exportHtml);

    $('btnToc').addEventListener('click', function () { S.toc = !S.toc; save(); applyToc(); });

    document.querySelectorAll('#viewSeg .btn').forEach(function (b) {
      b.addEventListener('click', function () { S.view = b.dataset.view; save(); applyView(); });
    });

    $('uiLang').addEventListener('change', function (e) {
      S.uiLang = e.target.value; save(); applyUiLang(); wireCodeCopy(); applyView();
    });
    $('dirSel').addEventListener('change', function (e) { S.dir = e.target.value; save(); render(); });
    $('themeSel').addEventListener('change', function (e) { S.theme = e.target.value; save(); applyTheme(); });

    // الإعدادات
    $('btnSettings').addEventListener('click', function () { el.settingsBack.classList.add('show'); });
    $('btnCloseSettings').addEventListener('click', function () { el.settingsBack.classList.remove('show'); });
    el.settingsBack.addEventListener('click', function (e) {
      if (e.target === el.settingsBack) el.settingsBack.classList.remove('show');
    });
    $('fontSel').addEventListener('change', function (e) { S.fontFamily = e.target.value; save(); applyTypography(); });
    $('fontSize').addEventListener('input', function (e) { S.fontSize = +e.target.value; save(); applyTypography(); });
    $('lineHeight').addEventListener('input', function (e) { S.lineHeight = +e.target.value; save(); applyTypography(); });
    $('contentWidth').addEventListener('input', function (e) { S.contentWidth = +e.target.value; save(); applyTypography(); });
    $('syncScroll').addEventListener('change', function (e) { S.syncScroll = e.target.checked; save(); });
    $('autoSave').addEventListener('change', function (e) { S.autoSave = e.target.checked; save(); });
    $('btnResetSettings').addEventListener('click', function () {
      S = Object.assign({}, DEFAULTS); save(); applyAll(); render();
    });

    // المحرر
    el.editor.addEventListener('input', function () {
      state.text = el.editor.value; markDirty(); scheduleRender();
    });
    el.editor.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var s = el.editor.selectionStart;
        el.editor.setRangeText('  ', s, el.editor.selectionEnd, 'end');
        state.text = el.editor.value; markDirty(); scheduleRender();
      }
    });

    // البحث
    var searchTimer = null;
    el.search.addEventListener('input', function (e) {
      clearTimeout(searchTimer);
      var v = e.target.value;
      searchTimer = setTimeout(function () { runSearch(v); }, 220);
    });
    el.search.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); focusHit(state.hitIndex + (e.shiftKey ? -1 : 1)); }
      if (e.key === 'Escape') { el.search.value = ''; clearSearch(); el.search.blur(); }
    });
    $('btnNext').addEventListener('click', function () { focusHit(state.hitIndex + 1); });
    $('btnPrev').addEventListener('click', function () { focusHit(state.hitIndex - 1); });

    // اختيار ملف احتياطي
    el.filePicker.addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { setDoc(String(rd.result), null, f.name); };
      rd.readAsText(f, 'utf-8');
      e.target.value = '';
    });

    // السحب والإفلات
    var dragDepth = 0;
    window.addEventListener('dragenter', function (e) {
      e.preventDefault(); dragDepth++; document.body.classList.add('dragging');
    });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('dragleave', function (e) {
      e.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); }
    });
    window.addEventListener('drop', function (e) {
      e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging');
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      if (HAS_NATIVE && f.path) {
        N.readPath(f.path).then(function (r) { if (r.ok) setDoc(r.content, r.path); });
        return;
      }
      var rd = new FileReader();
      rd.onload = function () { setDoc(String(rd.result), null, f.name); };
      rd.readAsText(f, 'utf-8');
    });

    // اختصارات لوحة المفاتيح
    window.addEventListener('keydown', function (e) {
      var ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      var k = e.key.toLowerCase();
      if (k === 'o') { e.preventDefault(); doOpen(); }
      else if (k === 's') { e.preventDefault(); e.shiftKey ? doSaveAs() : doSave(); }
      else if (k === 'f') { e.preventDefault(); el.search.focus(); el.search.select(); }
      else if (k === 'e') { e.preventDefault(); S.view = (S.view === 'editor' ? 'preview' : 'editor'); save(); applyView(); }
      else if (k === '1') { e.preventDefault(); S.view = 'preview'; save(); applyView(); }
      else if (k === '2') { e.preventDefault(); S.view = 'split'; save(); applyView(); }
      else if (k === '3') { e.preventDefault(); S.view = 'editor'; save(); applyView(); }
      else if (k === '\\') { e.preventDefault(); S.toc = !S.toc; save(); applyToc(); }
      else if (k === ',') { e.preventDefault(); el.settingsBack.classList.toggle('show'); }
      else if (k === '=' || k === '+') { e.preventDefault(); S.fontSize = Math.min(30, S.fontSize + 1); save(); applyTypography(); }
      else if (k === '-') { e.preventDefault(); S.fontSize = Math.max(12, S.fontSize - 1); save(); applyTypography(); }
      else if (k === '0') { e.preventDefault(); S.fontSize = DEFAULTS.fontSize; save(); applyTypography(); }
      else if (document.activeElement === el.editor) {
        if (k === 'b') { e.preventDefault(); wrapSelection('**', '**', 'نص'); }
        else if (k === 'i') { e.preventDefault(); wrapSelection('*', '*', 'نص'); }
        else if (k === 'k') { e.preventDefault(); wrapSelection('[', '](https://)', 'رابط'); }
      }
    });

    // في المتصفح فقط: تحذير المتصفح عند الخروج.
    // في Electron ممنوع — لأنه بيلغي الإغلاق بصمت والنافذة ما بتقفلش.
    // بديله رسالة ويندوز الحقيقية من main.js
    if (!HAS_NATIVE) {
      window.addEventListener('beforeunload', function (e) {
        if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
      });
    }
  }

  /* =============================== الإقلاع =============================== */
  function boot() {
    applyAll();
    bind();
    setupScrollSpy();

    if (HAS_NATIVE) {
      // ملف مُمرَّر من ويندوز (فتح بواسطة…)
      N.onOpenPath(function (r) { if (r && r.ok) setDoc(r.content, r.path); });
      N.onMenu(function (action) {
        if (action === 'open') doOpen();
        else if (action === 'save') doSave();
        else if (action === 'save-then-close') {
          state.pendingClose = true;
          doSave();
        }
      });
      N.ready();
    }
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
