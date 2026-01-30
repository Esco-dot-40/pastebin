
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const db = new Database(path.join(dataDir, 'database.sqlite'));

console.log('--- Database Inspection ---');

const pageAccessesCount = db.prepare('SELECT COUNT(*) as count FROM page_accesses').get().count;
console.log(`Page Accesses: ${pageAccessesCount}`);

if (pageAccessesCount > 0) {
    const lastPageAccess = db.prepare('SELECT * FROM page_accesses ORDER BY timestamp DESC LIMIT 1').get();
    console.log('Last Page Access:', JSON.stringify(lastPageAccess, null, 2));

    const pathStats = db.prepare('SELECT path, COUNT(*) as count FROM page_accesses GROUP BY path ORDER BY count DESC LIMIT 5').all();
    console.log('Top Paths:', JSON.stringify(pathStats, null, 2));

    const geoStats = db.prepare('SELECT country, city, COUNT(*) as count FROM page_accesses WHERE country IS NOT NULL GROUP BY country, city ORDER BY count DESC LIMIT 5').all();
    console.log('Top Geo Locations:', JSON.stringify(geoStats, null, 2));
}

const pasteViewsCount = db.prepare('SELECT COUNT(*) as count FROM paste_views').get().count;
console.log(`\nPaste Views: ${pasteViewsCount}`);

if (pasteViewsCount > 0) {
    const lastPasteView = db.prepare('SELECT * FROM paste_views ORDER BY timestamp DESC LIMIT 1').get();
    console.log('Last Paste View:', JSON.stringify(lastPasteView, null, 2));
}

const pastesWithViews = db.prepare('SELECT id, title, views FROM pastes WHERE views > 0 ORDER BY views DESC LIMIT 5').all();
console.log('\nTop Pastes by View Count:', JSON.stringify(pastesWithViews, null, 2));
