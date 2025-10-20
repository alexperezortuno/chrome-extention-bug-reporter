import shell from 'shelljs';
import path from 'path';
import os from 'os';

const distDir = path.resolve('dist');
const keyFile = path.resolve('dist.pem');
const outputCrx = path.resolve('dist.crx');

// Detecta la ruta de Chrome según SO
function getChromeCommand() {
    const platform = os.platform();
    if (platform === 'win32') {
        // Rutas posibles de Chrome en Windows
        const paths = [
            '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"',
            '"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"'
        ];
        for (const p of paths) {
            if (shell.test('-f', p.replace(/"/g, ''))) return p;
        }
        console.error('❌ Chrome not found on Windows.');
        process.exit(1);
    } else if (platform === 'darwin') {
        // macOS
        return '/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome';
    } else {
        // Linux
        return 'google-chrome';
    }
}

const chromeCmd = getChromeCommand();
let cmd;
console.log(`📦 Packing Chrome extension from ${distDir}`);
if (keyFile && shell.test('-f', keyFile)) {
    cmd = `${chromeCmd} --pack-extension=${distDir} --pack-extension-key=${keyFile}`;
} else {
    cmd = `${chromeCmd} --pack-extension=${distDir}`;
}

if (shell.exec(cmd).code !== 0) {
    console.error('❌ Failed to pack extension.');
    process.exit(1);
} else {
    console.log(`✅ Extension packed successfully: ${outputCrx}`);
}
