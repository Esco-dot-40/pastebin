import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data', 'database.sqlite');

console.log(`Checking database at: ${dbPath}`);

try {
    const db = new Database(dbPath);

    const counts = {
        folders: db.prepare('SELECT count(*) as count FROM folders').get().count,
        pastes: db.prepare('SELECT count(*) as count FROM pastes').get().count,
        paste_views: db.prepare('SELECT count(*) as count FROM paste_views').get().count,
        paste_reactions: db.prepare('SELECT count(*) as count FROM paste_reactions').get().count,
        page_accesses: db.prepare('SELECT count(*) as count FROM page_accesses').get().count,
        access_keys: db.prepare('SELECT count(*) as count FROM access_keys').get().count,
        users: db.prepare('SELECT count(*) as count FROM users').get().count
    };

    console.log('\n--- Database Integrity Check ---');
    console.table(counts);

    // Check for recent analytics activity
    const recentHits = db.prepare('SELECT path, ip, timestamp FROM page_accesses ORDER BY timestamp DESC LIMIT 5').all();
    console.log('\n--- Recent Page Accesses ---');
    console.table(recentHits);

    const recentViews = db.prepare('SELECT pasteId, ip, timestamp FROM paste_views ORDER BY timestamp DESC LIMIT 5').all();
    console.log('\n--- Recent Paste Views ---');
    console.table(recentViews);

    // Verify if heatmap data is available
    const geoData = db.prepare(`
        SELECT city, country, count(*) as count 
        FROM (SELECT city, country FROM paste_views UNION ALL SELECT city, country FROM page_accesses)
        WHERE city IS NOT NULL
        GROUP BY city, country
        LIMIT 5
    `).all();
    console.log('\n--- Geographic Reach Sample ---');
    console.table(geoData);

    console.log('\n✅ Analytics Data Verification Complete.');
    db.close();
} catch (e) {
    console.error('❌ Database verification failed:', e.message);
}
