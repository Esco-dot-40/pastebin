
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = 'c:/Users/voee1/.gemini/antigravity/scratch/pastebin-dual/data/database.sqlite';
const db = new Database(dbPath);

try {
    const pageAccesses = db.prepare('SELECT COUNT(*) as count FROM page_accesses').get().count;
    const pasteViews = db.prepare('SELECT COUNT(*) as count FROM paste_views').get().count;
    const blockedCount = db.prepare('SELECT COUNT(*) as count FROM blocked_countries').get().count;
    const settings = db.prepare('SELECT * FROM firewall_settings').all();
    
    console.log(JSON.stringify({
        pageAccesses,
        pasteViews,
        blockedCount,
        settings
    }, null, 2));
} catch (e) {
    console.error(e.message);
}
