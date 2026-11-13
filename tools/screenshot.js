// Starts the app with a fresh profile and Chromium's fake camera (so no real device opens),
// waits for the scopes to settle on the test pattern, and saves docs/screenshot.png.
// Run with: npm run screenshot
// Optional: --out=<file> to save somewhere else.

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const outArg = process.argv.find(a => a.startsWith('--out='));
const out = outArg ? path.resolve(outArg.slice(6)) : path.join(__dirname, '..', 'docs', 'screenshot.png');

// Started as `electron tools/screenshot.js`, Electron can't see the app's package.json, so set its version here
app.setVersion(require('../package.json').version);
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
process.env.SOJ_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-opera-joe-shot-'));

require('../main.js');

app.whenReady().then(() => {
    setTimeout(async () => {
        const win = BrowserWindow.getAllWindows()[0];
        win.setContentSize(1600, 900);
        await new Promise(r => setTimeout(r, 2500));
        // Nothing focused or open (a focused list can show up opened in the capture)
        await win.webContents.executeJavaScript('document.activeElement?.blur()');
        await new Promise(r => setTimeout(r, 300));
        const image = await win.webContents.capturePage();
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, image.toPNG());
        console.log('Saved ' + out + ' (' + image.getSize().width + 'x' + image.getSize().height + ')');
        app.quit();
    }, 1500);
});
