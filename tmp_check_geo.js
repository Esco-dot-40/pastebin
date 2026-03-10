
import Database from 'better-sqlite3';
const db = new Database('c:/Users/voee1/.gemini/antigravity/scratch/pastebin-dual/data/database.sqlite');
console.log(JSON.stringify(db.prepare('SELECT * FROM blocked_countries').all(), null, 2));
console.log(JSON.stringify(db.prepare('SELECT DISTINCT countryCode FROM page_accesses').all(), null, 2));
