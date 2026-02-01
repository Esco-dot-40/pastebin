import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const firewallDbPath = path.join(__dirname, 'data', 'firewall.db');

console.log(`Checking databases at: ${dbPath} and ${firewallDbPath}`);

try {
    const db = new Database(dbPath);
    let fdb;
    try {
        fdb = new Database(firewallDbPath);
    } catch (e) {
        console.warn('⚠️ firewall.db not found yet.');
    }

    const counts = {
        folders: db.prepare('SELECT count(*) as count FROM folders').get().count,
        pastes: db.prepare('SELECT count(*) as count FROM pastes').get().count,
        paste_views: db.prepare('SELECT count(*) as count FROM paste_views').get().count,
        paste_reactions: db.prepare('SELECT count(*) as count FROM paste_reactions').get().count,
        page_accesses_OLD: db.prepare('SELECT count(*) as count FROM page_accesses').get().count,
        page_accesses_NEW: fdb ? fdb.prepare('SELECT count(*) as count FROM page_accesses').get().count : 0,
        access_keys: db.prepare('SELECT count(*) as count FROM access_keys').get().count,
        users: db.prepare('SELECT count(*) as count FROM users').get().count,
        blocked_countries: fdb ? fdb.prepare('SELECT count(*) as count FROM blocked_countries').get().count : 0
    };

    console.log('\n--- Database Integrity Check ---');
    console.table(counts);

    // Check for recent analytics activity
    if (fdb) {
        const recentHits = fdb.prepare('SELECT path, ip, timestamp FROM page_accesses ORDER BY timestamp DESC LIMIT 5').all();
        console.log('\n--- Recent Page Accesses (Firewall DB) ---');
        console.table(recentHits);
    }

    const recentViews = db.prepare('SELECT pasteId, ip, timestamp FROM paste_views ORDER BY timestamp DESC LIMIT 5').all();
    console.log('\n--- Recent Paste Views (Main DB) ---');
    console.table(recentViews);

    // Verify if heatmap data is available
    if (fdb) {
        const geoData = fdb.prepare(`
            SELECT city, country, count(*) as count 
            FROM page_accesses
            WHERE city IS NOT NULL
            GROUP BY city, country
            LIMIT 5
        `).all();
        console.log('\n--- Geographic Reach Sample (Firewall DB) ---');
        console.table(geoData);
    }

    console.log('\n✅ Analytics Data Verification Complete.');
    db.close();
    if (fdb) fdb.close();
} catch (e) {
    console.error('❌ Database verification failed:', e.message);
}
