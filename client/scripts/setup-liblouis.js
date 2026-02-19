import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_DIR = path.join(__dirname, '../public/liblouis-build');

// Files to download
// Trying 'build/' path first based on common patterns.
// If this fails, we might need to adjust based on package structure.
const FILES = [
    // liblouis-build versions on npm (3.2.0-rc) seem to be asm.js only (no wasm).
    // We download the JS build and rename it to liblouis.js.
    {
        url: 'https://unpkg.com/liblouis-build/build-no-tables-utf16.js',
        name: 'liblouis.js'
    },
    // Braille Tables
    {
        url: 'https://raw.githubusercontent.com/liblouis/liblouis/master/tables/en-ueb-g2.ctb',
        name: 'en-ueb-g2.ctb'
    },
    {
        url: 'https://raw.githubusercontent.com/liblouis/liblouis/master/tables/en-us-g1.ctb',
        name: 'en-us-g1.ctb'
    }
];

if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
}

function downloadFile(file) {
    const dest = path.join(DEST_DIR, file.name);
    console.log(`Downloading ${file.name} from ${file.url}...`);
    try {
        // Use curl with -L (follow redirects) and -o (output file)
        // Check if Windows or Linux to ensure command compatibility? curl works on both.
        // On Windows Powershell curl is an alias for Invoke-WebRequest unless .exe is specified or curl.exe is used.
        // We'll try just 'curl', if it fails we might need 'curl.exe'.
        // To be safe on generic Windows, we can assume external curl is installed or use Powershell's curl.
        // But 'curl' in cmd is usually the real curl.
        // We will wrap the command in valid shell syntax.
        execSync(`curl -L -o "${dest}" "${file.url}"`, { stdio: 'inherit' });
        console.log(`Downloaded ${file.name}`);
    } catch (error) {
        console.error(`Failed to download ${file.name}:`, error.message);
        throw error;
    }
}

async function main() {
    try {
        for (const file of FILES) {
            downloadFile(file);
        }
        console.log('All files downloaded successfully!');
    } catch (error) {
        console.error('Error downloading files.');
        process.exit(1);
    }
}

main();
