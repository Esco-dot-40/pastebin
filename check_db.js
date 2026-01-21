import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'data', 'database.sqlite'));

const views = db.prepare('SELECT * FROM paste_views LIMIT 5').all();
console.log('--- VIEWS ---');
console.log(JSON.stringify(views, null, 2));

const pageAccesses = db.prepare('SELECT * FROM page_accesses LIMIT 5').all();
console.log('--- PAGE ACCESSES ---');
console.log(JSON.stringify(pageAccesses, null, 2));

const stats = db.prepare('SELECT COUNT(*) as count FROM paste_views').get();
console.log('--- STATS ---');
console.log('Total Views:', stats.count);
