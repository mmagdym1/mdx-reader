/* ==========================================================================
   MDX Reader — عملية Electron الرئيسية
   ========================================================================== */
const { app, BrowserWindow, dialog, ipcMain, shell, Menu, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');

// أيقونة النافذة: يجرّب ico ثم png ثم يسيبها للنظام
function appIcon() {
  const candidates = [
    path.join(__dirname, 'build', 'icon.ico'),
    path.join(__dirname, 'app', 'icon.png'),
    path.join(process.resourcesPath || '', 'icon.ico')
  ];
  for (const c of candidates) {
    try { if (c && fsSync.existsSync(c)) return c; } catch (e) {}
  }
  return undefined;
}

let win = null;
let pendingPath = null;   // ملف مُمرَّر من سطر الأوامر / "فتح بواسطة"
let rendererReady = false;
let isDirty = false;      // فيه تعديلات غير محفوظة؟
let forceClose = false;   // تخطّي سؤال الإغلاق
let closeAsked = false;   // رسالة الإغلاق معروضة دلوقتي؟

// عنوان النافذة بيحمل رقم الإصدار عشان تعرف أي نسخة شغالة
const TITLE = 'MDX Reader v' + app.getVersion();

const MD_EXT = ['md', 'markdown', 'mdown', 'mkd', 'mdx', 'txt'];

/* ------------------------- التقاط الملف من ويندوز ------------------------ */
function pathFromArgv(argv) {
  const args = argv.slice(app.isPackaged ? 1 : 2);
  for (const a of args) {
    if (a.startsWith('-')) continue;
    const ext = path.extname(a).slice(1).toLowerCase();
    if (MD_EXT.includes(ext)) return a;
  }
  return null;
}

// نسخة واحدة فقط: أي فتح جديد يروح للنافذة الحالية
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const p = pathFromArgv(argv);
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      if (p) sendOpen(p);
    }
  });
}

// macOS
app.on('open-file', (e, p) => {
  e.preventDefault();
  if (rendererReady) sendOpen(p); else pendingPath = p;
});

/* ------------------------------- النافذة -------------------------------- */
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0d1117' : '#ffffff',
    title: TITLE,
    icon: appIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });

  /* سؤال الحفظ عند الإغلاق.
     بنستخدم showMessageBoxSync عن قصد: النسخة غير المتزامنة مع
     preventDefault بتسيب النافذة معلّقة لو حصل أي خطأ في الـ Promise.
     المتزامنة بتقف وتستنى الرد، والافتراضي إن النافذة تقفل. */
  win.on('close', (e) => {
    if (forceClose || !isDirty) return;
    if (closeAsked) return;          // الرسالة معروضة بالفعل، متفتحش تانية

    let choice = 1;                  // الافتراضي الآمن: اقفل بدون حفظ
    closeAsked = true;
    try {
      choice = dialog.showMessageBoxSync(win, {
        type: 'warning',
        noLink: true,
        buttons: ['حفظ / Save', 'إغلاق بدون حفظ / Close', 'إلغاء / Cancel'],
        defaultId: 0,
        cancelId: 2,
        title: 'MDX Reader',
        message: 'يوجد تعديلات غير محفوظة',
        detail: 'Save your changes before closing?'
      });
    } catch (err) {
      choice = 1;                    // أي خطأ ⇒ اقفل، متعلّقش النافذة
    }
    closeAsked = false;

    if (choice === 2) { e.preventDefault(); return; }   // إلغاء ⇒ ابقَ مفتوحًا
    if (choice === 1) { isDirty = false; return; }      // اقفل من غير حفظ

    // احفظ ثم اغلق: الـ renderer ينادي close-now بعد نجاح الحفظ
    e.preventDefault();
    if (win) win.webContents.send('menu', 'save-then-close');
  });

  // أي رابط خارجي يفتح في المتصفح مش جوه التطبيق
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  buildMenu();
}

function buildMenu() {
  const template = [
    {
      label: 'ملف / File',
      submenu: [
        { label: 'فتح… / Open…', accelerator: 'CmdOrCtrl+O', click: () => win.webContents.send('menu', 'open') },
        { label: 'حفظ / Save', accelerator: 'CmdOrCtrl+S', click: () => win.webContents.send('menu', 'save') },
        { type: 'separator' },
        { label: 'طباعة / Print', accelerator: 'CmdOrCtrl+P', click: () => win.webContents.print() },
        { type: 'separator' },
        {
          label: 'إغلاق إجباري بدون حفظ / Force close',
          accelerator: 'CmdOrCtrl+Shift+Q',
          click: () => { forceClose = true; isDirty = false; if (win) win.close(); }
        },
        { role: 'quit', label: 'خروج / Quit' }
      ]
    },
    {
      label: 'تحرير / Edit',
      submenu: [
        { role: 'undo', label: 'تراجع' }, { role: 'redo', label: 'إعادة' },
        { type: 'separator' },
        { role: 'cut', label: 'قص' }, { role: 'copy', label: 'نسخ' },
        { role: 'paste', label: 'لصق' }, { role: 'selectAll', label: 'تحديد الكل' }
      ]
    },
    {
      label: 'عرض / View',
      submenu: [
        { role: 'reload', label: 'إعادة تحميل' },
        { role: 'toggleDevTools', label: 'أدوات المطور' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'حجم افتراضي' },
        { role: 'zoomIn', label: 'تكبير' },
        { role: 'zoomOut', label: 'تصغير' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'ملء الشاشة' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function sendOpen(p) {
  try {
    const content = await fs.readFile(p, 'utf8');
    win.webContents.send('open-path', { ok: true, path: p, content });
    win.setTitle(path.basename(p) + ' — ' + TITLE);
  } catch (err) {
    win.webContents.send('open-path', { ok: false, error: String(err) });
  }
}

/* --------------------------------- IPC ---------------------------------- */
ipcMain.handle('ready', () => {
  rendererReady = true;
  const p = pendingPath || pathFromArgv(process.argv);
  pendingPath = null;
  if (p) sendOpen(p);
  return true;
});

ipcMain.handle('open-file', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'اختر ملف Markdown',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: MD_EXT },
      { name: 'كل الملفات / All files', extensions: ['*'] }
    ]
  });
  if (r.canceled || !r.filePaths.length) return { ok: false, canceled: true };
  try {
    const p = r.filePaths[0];
    const content = await fs.readFile(p, 'utf8');
    win.setTitle(path.basename(p) + ' — ' + TITLE);
    return { ok: true, path: p, content };
  } catch (err) { return { ok: false, error: String(err) }; }
});

ipcMain.handle('read-path', async (_e, p) => {
  try { return { ok: true, path: p, content: await fs.readFile(p, 'utf8') }; }
  catch (err) { return { ok: false, error: String(err) }; }
});

ipcMain.handle('save-file', async (_e, p, content) => {
  try { await fs.writeFile(p, content, 'utf8'); return { ok: true, path: p }; }
  catch (err) { return { ok: false, error: String(err) }; }
});

ipcMain.handle('save-file-as', async (_e, suggested, content) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'حفظ باسم',
    defaultPath: suggested,
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'HTML', extensions: ['html'] },
      { name: 'كل الملفات / All files', extensions: ['*'] }
    ]
  });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  try {
    await fs.writeFile(r.filePath, content, 'utf8');
    return { ok: true, path: r.filePath };
  } catch (err) { return { ok: false, error: String(err) }; }
});

ipcMain.handle('set-dirty', (_e, v) => { isDirty = !!v; });

ipcMain.handle('close-now', () => {
  forceClose = true;
  isDirty = false;
  if (win) win.close();
});

ipcMain.handle('open-external', (_e, url) => { shell.openExternal(url); });
ipcMain.handle('set-title', (_e, name) => { if (win) win.setTitle(name + ' — ' + TITLE); });

/* -------------------------------- الإقلاع -------------------------------- */
app.whenReady().then(createWindow);

// أي طلب خروج (Alt+F4 / Quit / إغلاق الجلسة) ما يتعلّقش على سؤال الحفظ
app.on('before-quit', () => { forceClose = true; });

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
