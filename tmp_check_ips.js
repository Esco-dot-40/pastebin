
import Database from 'better-sqlite3';
const db = new Database('c:/Users/voee1/.gemini/antigravity/scratch/pastebin-dual/data/database.sqlite');
console.log(JSON.stringify(db.prepare('SELECT ip, path, countryCode FROM page_accesses LIMIT 10').all(), null, 2));
