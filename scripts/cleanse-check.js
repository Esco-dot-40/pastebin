import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const directories = ['server', 'admin', 'public', 'shared'];
let hasErrors = false;

async function checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    try {
        // Simple syntax check using eval-like trick (don't actually run it)
        new Function(content);
        console.log(`✅ ${path.relative(rootDir, filePath)}: OK`);
    } catch (e) {
        console.error(`❌ ${path.relative(rootDir, filePath)}: ${e.message}`);
        hasErrors = true;
    }
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                walk(fullPath);
            }
        } else if (file.endsWith('.js')) {
            checkFile(fullPath);
        }
    }
}

console.log('--- Project Syntax Audit ---');
directories.forEach(dir => {
    const fullPath = path.join(rootDir, dir);
    if (fs.existsSync(fullPath)) {
        walk(fullPath);
    }
});

if (hasErrors) {
    process.exit(1);
} else {
    console.log('\n--- Audit Complete: All Clear ---');
}
