import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'data', 'firewall.db');

console.log('Opening DB at:', dbPath);
const db = new Database(dbPath);

try {
    db.prepare('ALTER TABLE page_accesses ADD COLUMN hostname TEXT').run();
    console.log('Column "hostname" added successfully.');
} catch (e) {
    if (e.message.includes('duplicate column name')) {
        console.log('Column "hostname" already exists.');
    } else {
        console.error('Error adding column:', e.message);
    }
}
db.close();
