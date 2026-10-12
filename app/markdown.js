/* ==========================================================================
   MDX Reader — محرك Markdown داخلي (بدون أي مكتبات خارجية)
   مصمم خصيصًا لدعم العربية + الإنجليزية + النص المختلط بدون مشاكل bidi.
   القاعدة الذهبية: كل عنصر كتلي ياخد dir="auto"، وكل نص لاتيني/كود
   ياخد عزل اتجاهي (bdi / unicode-bidi: isolate).
   ========================================================================== */
(function (global) {
  'use strict';

  /* ----------------------------- أدوات مساعدة ---------------------------- */

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(s) {
    return esc(s).replace(/'/g, '&#39;');
  }

  // روابط آمنة فقط
  function safeUrl(url) {
    var u = String(url || '').trim();
    if (/^\s*javascript:/i.test(u) || /^\s*vbscript:/i.test(u)) return '#';
    return u;
  }

  // توليد معرّف (id) يدعم العربية
  function slugify(text, used) {
    var s = String(text)
      .replace(/<[^>]+>/g, '')
      .trim()
      .toLowerCase()
      .replace(/[\s ]+/g, '-')
      .replace(/[^؀-ۿݐ-ݿ\w\-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!s) s = 'sec';
    if (used) {
      var base = s, n = 1;
      while (used[s]) { s = base + '-' + (++n); }
      used[s] = true;
    }
    return s;
  }

  // هل النص يبدأ بحرف عربي؟ (لتحديد الاتجاه يدويًا عند الحاجة)
  var RTL_RE = /[֑-߿יִ-﷽ﹰ-ﻼ]/;
  var LTR_RE = /[A-Za-zÀ-ɏ]/;

  // حروف عربية وحروف لاتينية (للعدّ، مش لأول حرف)
  var AR_G = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
  var LA_G = /[A-Za-zÀ-ɏ]/g;

  // نسبة العربي اللي بعدها نعتبر النص عربي بالكامل (20%)
  var AR_RATIO = 0.2;

  // ينضّف النص من الكود والروابط والوسوم قبل العدّ
  function plainOf(text) {
    return String(text)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/<[^>]*>/g, ' ');
  }

  /* اتجاه النص الذكي:
     الاعتماد على "أول حرف" (dir=auto) بيكسر العناوين والجمل اللي بتبدأ
     بكلمة إنجليزية وباقيها عربي. فبنعدّ الحروف: لو نسبة العربي معتبرة
     يبقى البلوك كله RTL، ولو مفيش عربي خالص يبقى LTR. */
  function detectDir(text) {
    var t = plainOf(text);
    var ar = (t.match(AR_G) || []).length;
    var la = (t.match(LA_G) || []).length;
    if (!ar && !la) return 'auto';
    if (!ar) return 'ltr';
    if (!la) return 'rtl';
    return (ar / (ar + la) >= AR_RATIO) ? 'rtl' : 'ltr';
  }

  // وضع الاتجاه الحالي: smart | rtl | ltr | auto
  var DIRMODE = 'smart';

  // يرجّع سمة dir الجاهزة للحقن في الوسم (أو فراغ لو الأنسب يرث من الأب)
  function dattr(text) {
    if (DIRMODE === 'rtl') return ' dir="rtl"';
    if (DIRMODE === 'ltr') return ' dir="ltr"';
    if (DIRMODE === 'auto') return ' dir="auto"';
    var d = detectDir(text);
    return d === 'auto' ? '' : ' dir="' + d + '"';
  }

  /* --------------------------- المعالجة السطرية --------------------------- */

  function matchClose(src, start, open, close) {
    // يرجّع فهرس القوس المغلق المطابق
    var depth = 0;
    for (var i = start; i < src.length; i++) {
      var c = src[i];
      if (c === '\\') { i++; continue; }
      if (c === open) depth++;
      else if (c === close) { depth--; if (depth === 0) return i; }
    }
    return -1;
  }

  function parseLinkDest(src, i) {
    // src[i] === '('  → يرجّع {href, title, end}
    var end = matchClose(src, i, '(', ')');
    if (end === -1) return null;
    var raw = src.slice(i + 1, end).trim();
    var href = raw, title = '';
    var tm = /^(<[^>]*>|\S+)\s+["'(]([\s\S]*)["')]$/.exec(raw);
    if (tm) { href = tm[1]; title = tm[2]; }
    href = href.replace(/^<|>$/g, '');
    return { href: href, title: title, end: end };
  }

  function inline(src, ctx) {
    var out = '';
    var i = 0;
    var n = src.length;

    while (i < n) {
      var c = src[i];

      /* --- هروب \x --- */
      if (c === '\\' && i + 1 < n && /[\\`*_{}\[\]()#+\-.!>~|"']/.test(src[i + 1])) {
        out += esc(src[i + 1]); i += 2; continue;
      }

      /* --- كود سطري `code` : يُعزل اتجاهيًا دائمًا --- */
      if (c === '`') {
        var cm = /^(`+)([\s\S]*?[^`])\1(?!`)/.exec(src.slice(i));
        if (cm) {
          var code = cm[2];
          if (/^ /.test(code) && / $/.test(code) && /[^ ]/.test(code)) code = code.slice(1, -1);
          out += '<code class="md-code-inline" dir="ltr">' + esc(code) + '</code>';
          i += cm[0].length; continue;
        }
      }

      /* --- معادلة $...$ (تُعرض ككود مائل) --- */
      if (c === '$' && src[i + 1] !== '$') {
        var mm = /^\$([^\n$]+?)\$/.exec(src.slice(i));
        if (mm) {
          out += '<span class="md-math" dir="ltr">' + esc(mm[1]) + '</span>';
          i += mm[0].length; continue;
        }
      }

      /* --- صورة ![alt](src) --- */
      if (c === '!' && src[i + 1] === '[') {
        var ib = matchClose(src, i + 1, '[', ']');
        if (ib !== -1 && src[ib + 1] === '(') {
          var idest = parseLinkDest(src, ib + 1);
          if (idest) {
            var alt = src.slice(i + 2, ib);
            out += '<img class="md-img" src="' + escAttr(safeUrl(idest.href)) + '" alt="' + escAttr(alt) + '"' +
              (idest.title ? ' title="' + escAttr(idest.title) + '"' : '') + ' loading="lazy">';
            i = idest.end + 1; continue;
          }
        }
      }

      /* --- حاشية سفلية [^1] --- */
      if (c === '[' && src[i + 1] === '^') {
        var fm = /^\[\^([^\]]+)\]/.exec(src.slice(i));
        if (fm) {
          var key = fm[1];
          ctx.fnOrder = ctx.fnOrder || [];
          var idx = ctx.fnOrder.indexOf(key);
          if (idx === -1) { ctx.fnOrder.push(key); idx = ctx.fnOrder.length - 1; }
          out += '<sup class="md-fnref"><a href="#fn-' + escAttr(slugify(key)) + '" id="fnref-' +
            escAttr(slugify(key)) + '">[' + (idx + 1) + ']</a></sup>';
          i += fm[0].length; continue;
        }
      }

      /* --- رابط [نص](هدف)  أو  [نص][مرجع] --- */
      if (c === '[') {
        var b = matchClose(src, i, '[', ']');
        if (b !== -1) {
          var label = src.slice(i + 1, b);
          if (src[b + 1] === '(') {
            var dest = parseLinkDest(src, b + 1);
            if (dest) {
              out += '<a class="md-link" href="' + escAttr(safeUrl(dest.href)) + '"' +
                (dest.title ? ' title="' + escAttr(dest.title) + '"' : '') + '>' +
                inline(label, ctx) + '</a>';
              i = dest.end + 1; continue;
            }
          }
          var rm = /^\[([^\]]*)\]/.exec(src.slice(b + 1));
          var refKey = rm ? (rm[1] || label) : label;
          var ref = ctx.refs[refKey.toLowerCase()];
          if (ref) {
            out += '<a class="md-link" href="' + escAttr(safeUrl(ref.href)) + '"' +
              (ref.title ? ' title="' + escAttr(ref.title) + '"' : '') + '>' + inline(label, ctx) + '</a>';
            i = b + 1 + (rm ? rm[0].length : 0); continue;
          }
        }
      }

      /* --- رابط تلقائي <https://...> أو <mail@x.com> --- */
      if (c === '<') {
        var am = /^<((?:https?|ftp):\/\/[^>\s]+)>/.exec(src.slice(i));
        if (am) {
          out += '<a class="md-link" href="' + escAttr(safeUrl(am[1])) + '" dir="ltr">' + esc(am[1]) + '</a>';
          i += am[0].length; continue;
        }
        var em = /^<([^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)>/.exec(src.slice(i));
        if (em) {
          out += '<a class="md-link" href="mailto:' + escAttr(em[1]) + '" dir="ltr">' + esc(em[1]) + '</a>';
          i += em[0].length; continue;
        }
        // وسوم HTML مسموح بها بشكل محدود
        var hm = /^<\/?(b|i|u|em|strong|sub|sup|br|kbd|mark|small|span|del|ins|abbr|bdi|bdo|dir|ruby|rt)(\s[^<>]*)?\/?>/i.exec(src.slice(i));
        if (hm) { out += hm[0]; i += hm[0].length; continue; }
      }

      /* --- رابط عاري https://... --- */
      if ((c === 'h' || c === 'w') && /^(https?:\/\/|www\.)/.test(src.slice(i))) {
        var bm = /^((?:https?:\/\/|www\.)[^\s<>()\[\]«»"']+)/.exec(src.slice(i));
        if (bm) {
          var url = bm[1].replace(/[.,;:!?]+$/, '');
          var full = /^www\./.test(url) ? 'https://' + url : url;
          out += '<a class="md-link" href="' + escAttr(safeUrl(full)) + '" dir="ltr">' + esc(url) + '</a>';
          i += url.length; continue;
        }
      }

      /* --- تشديد / مائل / شطب / تظليل --- */
      var rest = src.slice(i);
      var m;
      if ((m = /^\*\*\*([\s\S]+?)\*\*\*/.exec(rest))) {
        out += '<strong><em>' + inline(m[1], ctx) + '</em></strong>'; i += m[0].length; continue;
      }
      if ((m = /^\*\*([\s\S]+?)\*\*/.exec(rest))) {
        out += '<strong>' + inline(m[1], ctx) + '</strong>'; i += m[0].length; continue;
      }
      if ((m = /^\*([^\s*][\s\S]*?)\*/.exec(rest))) {
        out += '<em>' + inline(m[1], ctx) + '</em>'; i += m[0].length; continue;
      }
      if ((m = /^___([\s\S]+?)___/.exec(rest))) {
        out += '<strong><em>' + inline(m[1], ctx) + '</em></strong>'; i += m[0].length; continue;
      }
      if ((m = /^__([\s\S]+?)__/.exec(rest))) {
        out += '<strong>' + inline(m[1], ctx) + '</strong>'; i += m[0].length; continue;
      }
      if ((m = /^_([^\s_][\s\S]*?)_/.exec(rest)) && !/[\w؀-ۿ]/.test(src[i - 1] || '')) {
        out += '<em>' + inline(m[1], ctx) + '</em>'; i += m[0].length; continue;
      }
      if ((m = /^~~([\s\S]+?)~~/.exec(rest))) {
        out += '<del>' + inline(m[1], ctx) + '</del>'; i += m[0].length; continue;
      }
      if ((m = /^==([\s\S]+?)==/.exec(rest))) {
        out += '<mark>' + inline(m[1], ctx) + '</mark>'; i += m[0].length; continue;
      }

      /* --- فاصل سطر --- */
      if (c === '\n') { out += '<br>'; i++; continue; }

      out += esc(c);
      i++;
    }

    return out;
  }

  /* ------------------------------ كتل المستند ----------------------------- */

  var BULLET = /^([ \t]*)([-*+])[ \t]+(.*)$/;
  var ORDERED = /^([ \t]*)(\d{1,9})([.)])[ \t]+(.*)$/;

  function indentOf(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      if (s[i] === ' ') n++;
      else if (s[i] === '\t') n += 4;
      else break;
    }
    return n;
  }

  function parseBlocks(lines, ctx) {
    var html = '';
    var i = 0;

    function isBlank(l) { return l === undefined || /^[ \t]*$/.test(l); }

    while (i < lines.length) {
      var line = lines[i];

      /* --- سطر فارغ --- */
      if (isBlank(line)) { i++; continue; }

      /* --- كتلة كود مسيّجة ``` أو ~~~ --- */
      var fm = /^([ \t]*)(`{3,}|~{3,})[ \t]*([^\s`]*)[ \t]*(.*)$/.exec(line);
      if (fm) {
        var fence = fm[2][0], flen = fm[2].length, lang = (fm[3] || '').toLowerCase();
        var buf = [], j = i + 1;
        while (j < lines.length) {
          var cl = new RegExp('^[ \\t]*' + (fence === '`' ? '`' : '~') + '{' + flen + ',}[ \\t]*$');
          if (cl.test(lines[j])) break;
          buf.push(lines[j]); j++;
        }
        var codeText = buf.join('\n');
        html += '<div class="md-codeblock" data-lang="' + escAttr(lang) + '">' +
          '<div class="md-codebar"><span class="md-lang">' + esc(lang || 'text') + '</span>' +
          '<button class="md-copy" type="button" data-copy>نسخ</button></div>' +
          '<pre dir="ltr"><code class="lang-' + escAttr(lang) + '">' +
          highlight(codeText, lang) + '</code></pre></div>';
        i = j + 1; continue;
      }

      /* --- تعريف مرجع رابط --- */
      var dm = /^[ \t]{0,3}\[([^\]^]+)\]:[ \t]*(\S+)(?:[ \t]+["'(]([^"')]*)["')])?[ \t]*$/.exec(line);
      if (dm) {
        ctx.refs[dm[1].toLowerCase()] = { href: dm[2], title: dm[3] || '' };
        i++; continue;
      }

      /* --- تعريف حاشية [^1]: نص --- */
      var fdm = /^[ \t]{0,3}\[\^([^\]]+)\]:[ \t]*(.*)$/.exec(line);
      if (fdm) {
        var body = [fdm[2]];
        var k = i + 1;
        while (k < lines.length && (/^[ \t]{4,}/.test(lines[k]) || (!isBlank(lines[k]) && !/^\[\^/.test(lines[k]) && indentOf(lines[k]) > 0))) {
          body.push(lines[k].replace(/^[ \t]{1,4}/, '')); k++;
        }
        ctx.footnotes[fdm[1]] = body.join('\n');
        i = k; continue;
      }

      /* --- خط فاصل --- */
      if (/^[ \t]{0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/.test(line)) {
        html += '<hr class="md-hr">'; i++; continue;
      }

      /* --- عنوان ATX --- */
      var hm = /^[ \t]{0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/.exec(line);
      if (hm) {
        var lvl = hm[1].length;
        var txt = hm[2];
        var inner = inline(txt, ctx);
        var id = slugify(txt, ctx.usedIds);
        ctx.toc.push({ level: lvl, text: txt.replace(/[*_`~]/g, ''), id: id, dir: detectDir(txt) });
        html += '<h' + lvl + ' id="' + escAttr(id) + '" class="md-h md-h' + lvl + '"' + dattr(txt) + '>' +
          '<a class="md-anchor" href="#' + escAttr(id) + '" aria-hidden="true">#</a>' + inner + '</h' + lvl + '>';
        i++; continue;
      }

      /* --- عنوان Setext --- */
      if (!isBlank(lines[i + 1]) && /^[ \t]{0,3}(=+|-{2,})[ \t]*$/.test(lines[i + 1] || '') && !BULLET.test(line)) {
        var slvl = /=/.test(lines[i + 1]) ? 1 : 2;
        var sid = slugify(line, ctx.usedIds);
        ctx.toc.push({ level: slvl, text: line.replace(/[*_`~]/g, '').trim(), id: sid, dir: detectDir(line) });
        html += '<h' + slvl + ' id="' + escAttr(sid) + '" class="md-h md-h' + slvl + '"' + dattr(line) + '>' +
          '<a class="md-anchor" href="#' + escAttr(sid) + '" aria-hidden="true">#</a>' +
          inline(line.trim(), ctx) + '</h' + slvl + '>';
        i += 2; continue;
      }

      /* --- اقتباس --- */
      if (/^[ \t]{0,3}>/.test(line)) {
        var qb = [], q = i;
        while (q < lines.length && (/^[ \t]{0,3}>/.test(lines[q]) || (!isBlank(lines[q]) && qb.length))) {
          qb.push(lines[q].replace(/^[ \t]{0,3}>[ ]?/, '')); q++;
        }
        var cls = 'md-quote';
        var first = qb[0] || '';
        var cm2 = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO|هام|تنبيه|ملاحظة)\]\s*(.*)$/i.exec(first);
        var title = '';
        if (cm2) {
          cls += ' md-callout md-callout-' + cm2[1].toLowerCase();
          title = cm2[1];
          qb[0] = cm2[2] || '';
        }
        html += '<blockquote class="' + cls + '"' + dattr(qb.join(' ')) + '>' +
          (title ? '<div class="md-callout-title"' + dattr(title) + '>' + esc(title) + '</div>' : '') +
          parseBlocks(qb, ctx) + '</blockquote>';
        i = q; continue;
      }

      /* --- جدول GFM --- */
      if (line.indexOf('|') !== -1 && lines[i + 1] && /^[ \t]{0,3}\|?[ \t]*:?-{1,}:?[ \t]*(\|[ \t]*:?-{1,}:?[ \t]*)*\|?[ \t]*$/.test(lines[i + 1])) {
        var splitRow = function (r) {
          r = r.trim().replace(/^\|/, '').replace(/\|$/, '');
          var cells = [], cur = '', inCode = false;
          for (var x = 0; x < r.length; x++) {
            var ch = r[x];
            if (ch === '\\' && r[x + 1] === '|') { cur += '|'; x++; continue; }
            if (ch === '`') inCode = !inCode;
            if (ch === '|' && !inCode) { cells.push(cur); cur = ''; continue; }
            cur += ch;
          }
          cells.push(cur);
          return cells.map(function (s) { return s.trim(); });
        };
        var head = splitRow(line);
        var aligns = splitRow(lines[i + 1]).map(function (s) {
          if (/^:.*:$/.test(s)) return 'center';
          if (/^:/.test(s)) return 'start';
          if (/:$/.test(s)) return 'end';
          return '';
        });
        var rows = [], r2 = i + 2;
        while (r2 < lines.length && !isBlank(lines[r2]) && lines[r2].indexOf('|') !== -1) {
          rows.push(splitRow(lines[r2])); r2++;
        }
        var t = '<div class="md-tablewrap"><table class="md-table"><thead><tr>';
        head.forEach(function (h, ci) {
          t += '<th' + dattr(h) + (aligns[ci] ? ' style="text-align:' + aligns[ci] + '"' : '') + '>' + inline(h, ctx) + '</th>';
        });
        t += '</tr></thead><tbody>';
        rows.forEach(function (row) {
          t += '<tr>';
          for (var ci = 0; ci < head.length; ci++) {
            var cell = row[ci] === undefined ? '' : row[ci];
            t += '<td' + dattr(cell) + (aligns[ci] ? ' style="text-align:' + aligns[ci] + '"' : '') + '>' +
              inline(cell, ctx) + '</td>';
          }
          t += '</tr>';
        });
        t += '</tbody></table></div>';
        html += t; i = r2; continue;
      }

      /* --- قوائم --- */
      if (BULLET.test(line) || ORDERED.test(line)) {
        var res = parseList(lines, i, ctx);
        html += res.html; i = res.next; continue;
      }

      /* --- كود بمسافات بادئة (4) --- */
      if (/^(\t| {4})/.test(line) && !ctx.inListTight) {
        var ib2 = [], p = i;
        while (p < lines.length && (/^(\t| {4})/.test(lines[p]) || isBlank(lines[p]))) {
          ib2.push(lines[p].replace(/^(\t| {4})/, '')); p++;
        }
        while (ib2.length && isBlank(ib2[ib2.length - 1])) ib2.pop();
        html += '<div class="md-codeblock"><div class="md-codebar"><span class="md-lang">text</span>' +
          '<button class="md-copy" type="button" data-copy>نسخ</button></div>' +
          '<pre dir="ltr"><code>' + esc(ib2.join('\n')) + '</code></pre></div>';
        i = p; continue;
      }

      /* --- HTML خام (كتلة) --- */
      if (/^[ \t]{0,3}<(div|section|details|summary|table|figure|figcaption|p|center|iframe|video|audio|img|hr|br|dl|dt|dd)\b/i.test(line)) {
        var hb = [], h2 = i;
        while (h2 < lines.length && !isBlank(lines[h2])) { hb.push(lines[h2]); h2++; }
        html += '<div class="md-rawhtml"' + dattr(hb.join(' ')) + '>' + hb.join('\n') + '</div>';
        i = h2; continue;
      }

      /* --- فقرة --- */
      var pb = [], pi = i;
      while (pi < lines.length && !isBlank(lines[pi])
        && !/^[ \t]{0,3}(#{1,6})[ \t]/.test(lines[pi])
        && !/^[ \t]{0,3}>/.test(lines[pi])
        && !/^([ \t]*)(`{3,}|~{3,})/.test(lines[pi])
        && !(pi > i && (BULLET.test(lines[pi]) || ORDERED.test(lines[pi])))
        && !/^[ \t]{0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/.test(lines[pi])) {
        pb.push(lines[pi]); pi++;
      }
      if (!pb.length) { pb.push(lines[i]); pi = i + 1; }
      var ptxt = pb.join('\n').replace(/[ ]{2,}\n/g, '\n');
      html += '<p class="md-p"' + dattr(ptxt) + '>' + inline(ptxt.trim(), ctx) + '</p>';
      i = pi;
    }

    return html;
  }

  function parseList(lines, start, ctx) {
    var first = lines[start];
    var om = ORDERED.exec(first);
    var ordered = !!om;
    var baseIndent = indentOf(first);
    var startNum = ordered ? parseInt(om[2], 10) : 1;
    var items = [];
    var i = start;
    var loose = false;

    while (i < lines.length) {
      var l = lines[i];
      if (/^[ \t]*$/.test(l)) {
        // سطر فارغ: نتحقق هل القائمة مستمرة
        var k = i + 1;
        while (k < lines.length && /^[ \t]*$/.test(lines[k])) k++;
        if (k < lines.length && (indentOf(lines[k]) > baseIndent ||
          ((BULLET.test(lines[k]) || ORDERED.test(lines[k])) && indentOf(lines[k]) >= baseIndent))) {
          loose = true; i = k; continue;
        }
        break;
      }
      var bm2 = BULLET.exec(l), om2 = ORDERED.exec(l);
      var ind = indentOf(l);

      if ((bm2 || om2) && ind <= baseIndent + 1) {
        if (ind < baseIndent) break;
        var isOrd = !!om2;
        if (isOrd !== ordered && items.length) break;
        var content = isOrd ? om2[4] : bm2[3];
        items.push([content]);
        i++;
        continue;
      }
      if (!items.length) break;
      if (ind > baseIndent || /^[ \t]/.test(l)) {
        items[items.length - 1].push(l.replace(new RegExp('^[ \\t]{0,' + (baseIndent + 2) + '}'), ''));
        i++; continue;
      }
      // استمرار كسول للفقرة
      items[items.length - 1].push(l);
      i++;
    }

    var tag = ordered ? 'ol' : 'ul';
    var out = '<' + tag + ' class="md-list' + (loose ? ' md-loose' : '') + '"' +
      (ordered && startNum !== 1 ? ' start="' + startNum + '"' : '') + '>';
    var hasTask = false;

    items.forEach(function (itemLines) {
      var body = itemLines.join('\n');
      var task = /^\[([ xX])\]\s+([\s\S]*)$/.exec(body);
      var checked = false, isTask = false;
      if (task) {
        isTask = true; hasTask = true;
        checked = task[1].toLowerCase() === 'x';
        body = task[2];
      }
      var sub = parseBlocks(body.split('\n'), ctx);
      // في العناصر المضغوطة نشيل غلاف <p> الوحيد
      if (!loose) {
        var only = /^<p class="md-p"[^>]*>([\s\S]*?)<\/p>([\s\S]*)$/.exec(sub);
        if (only && only[2].indexOf('<p ') === -1) sub = only[1] + only[2];
      }
      out += '<li class="md-li' + (isTask ? ' md-task' : '') + '"' + dattr(body) + '>' +
        (isTask ? '<input type="checkbox" class="md-check" disabled' + (checked ? ' checked' : '') + '> ' : '') +
        sub + '</li>';
    });

    out += '</' + tag + '>';
    if (hasTask) out = out.replace('class="md-list', 'class="md-list md-tasklist');
    return { html: out, next: i };
  }

  /* --------------------------- تلوين الكود البسيط -------------------------- */

  var KEYWORDS = {
    js: 'const let var function return if else for while class new this async await import export from default try catch finally throw typeof instanceof null undefined true false extends super yield of in delete void switch case break continue do static get set',
    ts: 'const let var function return if else for while class new this async await import export from default try catch finally throw typeof instanceof null undefined true false interface type enum implements public private protected readonly extends super as satisfies',
    py: 'def class return if elif else for while import from as try except finally raise with lambda None True False and or not in is pass break continue global nonlocal yield async await assert del',
    sql: 'select from where insert update delete create table alter drop join left right inner outer on group by order having limit offset union all as and or not null primary key foreign references index values into set distinct case when then end',
    sh: 'if then else fi for while do done case esac function return export local echo cd ls mkdir rm cp mv cat grep sed awk sudo apt npm node git',
    json: 'true false null',
    html: '', css: '', text: ''
  };
  var ALIAS = {
    javascript: 'js', jsx: 'js', node: 'js', typescript: 'ts', tsx: 'ts',
    python: 'py', bash: 'sh', shell: 'sh', zsh: 'sh', console: 'sh',
    yml: 'yaml', md: 'text', markdown: 'text'
  };

  function highlight(code, lang) {
    lang = ALIAS[lang] || lang;
    var e = esc(code);
    var kw = KEYWORDS[lang];

    // تعليقات ونصوص أولًا عبر عناصر نائبة
    // عناصر نائبة من منطقة الاستخدام الخاص حتى لا تلمسها قواعد التلوين
    var store = [];
    var ph = function (html) {
      var id = String(store.push(html) - 1).split('').map(function (dg) {
        return String.fromCharCode(0xE000 + (+dg));
      }).join('');
      return '\u0000' + id + '\u0000';
    };

    e = e.replace(/(&quot;[^&\n]*?&quot;|&#39;[^&\n]*?&#39;|`[^`\n]*?`|'[^'\n]*?'|"[^"\n]*?")/g, function (m) {
      return ph('<span class="tok-str">' + m + '</span>');
    });
    e = e.replace(/(\/\/[^\n]*|#[^\n]*|--[^\n]*)/g, function (m, g, off, s) {
      if (/^#[0-9a-fA-F]{3,8}\b/.test(m)) return m;
      return ph('<span class="tok-cmt">' + m + '</span>');
    });
    e = e.replace(/\/\*[\s\S]*?\*\//g, function (m) { return ph('<span class="tok-cmt">' + m + '</span>'); });

    if (kw) {
      var re = new RegExp('\\b(' + kw.trim().split(/\s+/).join('|') + ')\\b', 'g');
      e = e.replace(re, '<span class="tok-kw">$1</span>');
    }
    e = e.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
    e = e.replace(/([A-Za-z_$][\w$]*)\s*\(/g, '<span class="tok-fn">$1</span>(');

    e = e.replace(/\u0000([\uE000-\uE009]+)\u0000/g, function (_, k) {
      var idx = k.split('').map(function (ch) { return ch.charCodeAt(0) - 0xE000; }).join('');
      return store[+idx];
    });
    return e;
  }

  /* ------------------------------- الواجهة -------------------------------- */

  function render(src, opts) {
    opts = opts || {};
    DIRMODE = (['smart', 'rtl', 'ltr', 'auto'].indexOf(opts.dir) !== -1) ? opts.dir : 'smart';
    src = String(src == null ? '' : src).replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');

    var ctx = {
      refs: {}, footnotes: {}, toc: [], usedIds: {}, fnOrder: []
    };

    var frontMatter = null;
    var fmm = /^---\n([\s\S]*?)\n---\n?/.exec(src);
    if (fmm) { frontMatter = fmm[1]; src = src.slice(fmm[0].length); }

    var lines = src.split('\n');
    var html = parseBlocks(lines, ctx);

    // الحواشي
    if (ctx.fnOrder.length) {
      var f = '<section class="md-footnotes"><hr class="md-hr"><ol>';
      ctx.fnOrder.forEach(function (key) {
        var txt = ctx.footnotes[key] || '';
        f += '<li id="fn-' + escAttr(slugify(key)) + '"' + dattr(txt) + '>' + inline(txt, ctx) +
          ' <a class="md-fnback" href="#fnref-' + escAttr(slugify(key)) + '">↩</a></li>';
      });
      f += '</ol></section>';
      html += f;
    }

    var fmHtml = '';
    if (frontMatter && opts.showFrontMatter !== false) {
      fmHtml = '<div class="md-frontmatter" dir="auto"><pre dir="ltr">' + esc(frontMatter) + '</pre></div>';
    }

    return { html: fmHtml + html, toc: ctx.toc, frontMatter: frontMatter, docDir: detectDir(src.slice(0, 8000)) };
  }

  global.MDX = { render: render, slugify: slugify, escape: esc, detectDir: detectDir, dirAttr: dattr };

})(typeof window !== 'undefined' ? window : this);
