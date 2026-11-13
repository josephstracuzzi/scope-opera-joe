// Renders the SVG artwork to the PNG / ICO files the app and the builds use. Run with: npm run logos
//   logo.svg  -> logo.png  (header and About box; 3x for sharp text on high-DPI screens)
//   icon.svg  -> icon.png  (512 px, window and Mac/Linux app icon)
//            -> logo.ico  (16-256 px, Windows app icon)
// logo.svg uses live Bebas Neue text loaded from Google Fonts, so this needs an internet connection.
// The finished PNGs are committed, so the app itself never fetches a font.

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let win = null;

// The SVG is drawn into a page at scale, then captured with its transparent background
async function render(svgFile, scale) {
    const svg = fs.readFileSync(path.join(root, svgFile), 'utf8');
    const [, , width, height] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    const W = Math.round(width * scale), H = Math.round(height * scale);
    win.setContentSize(W, H);
    const html = `<!doctype html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}
        svg{display:block;width:${W}px;height:${H}px}</style></head><body>${svg}</body></html>`;
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await win.webContents.executeJavaScript(
        "document.fonts.load('107px \"Bebas Neue\"').then(() => document.fonts.ready).then(() => new Promise(r => setTimeout(r, 300)))"
    );
    return win.webContents.capturePage({ x: 0, y: 0, width: W, height: H });
}

// An .ico file can hold PNG images directly (Windows Vista and later)
function writeIco(file, pngs) {
    const header = Buffer.alloc(6 + 16 * pngs.length);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(pngs.length, 4);
    let offset = header.length;
    pngs.forEach(({ size, data }, i) => {
        const e = 6 + 16 * i;
        header.writeUInt8(size >= 256 ? 0 : size, e);
        header.writeUInt8(size >= 256 ? 0 : size, e + 1);
        header.writeUInt16LE(1, e + 4);
        header.writeUInt16LE(32, e + 6);
        header.writeUInt32LE(data.length, e + 8);
        header.writeUInt32LE(offset, e + 12);
        offset += data.length;
    });
    fs.writeFileSync(file, Buffer.concat([header, ...pngs.map(p => p.data)]));
}

app.whenReady().then(async () => {
    try {
        win = new BrowserWindow({
            show: false, frame: false, transparent: true, useContentSize: true, enableLargerThanScreen: true,
            webPreferences: { offscreen: true }
        });

        const logo = await render('logo.svg', 3);
        fs.writeFileSync(path.join(root, 'logo.png'), logo.toPNG());

        const icon = await render('icon.svg', 512 / 88);
        fs.writeFileSync(path.join(root, 'icon.png'), icon.toPNG());

        const sizes = [256, 128, 64, 48, 32, 24, 16];
        writeIco(path.join(root, 'logo.ico'), sizes.map(size => ({
            size, data: icon.resize({ width: size, height: size, quality: 'best' }).toPNG()
        })));
        const s = logo.getSize(), i = icon.getSize();
        console.log(`logo.png ${s.width}x${s.height}, icon.png ${i.width}x${i.height}, logo.ico ${sizes.join('/')}`);
    } catch (err) {
        console.error(err);
        process.exitCode = 1;
    }
    app.quit();
});
