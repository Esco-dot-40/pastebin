// Quick database inspection script
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const db = new Database(path.join(dataDir, 'database.sqlite'));

console.log('=== DATABASE INSPECTION ===\n');

// Check if paste_reactions table exists
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('📊 Tables:', tables.map(t => t.name).join(', '));

// Count reactions
const reactionCount = db.prepare('SELECT COUNT(*) as count FROM paste_reactions').get();
console.log(`\n💖 Total Reactions in DB: ${reactionCount.count}`);

// Show sample reactions if any exist
if (reactionCount.count > 0) {
    const sampleReactions = db.prepare('SELECT * FROM paste_reactions ORDER BY createdAt DESC LIMIT 10').all();
    console.log('\n📝 Sample Reactions:');
    sampleReactions.forEach(r => {
        console.log(`  - Paste: ${r.pasteId}, Type: ${r.type}, User: ${r.username || r.userId || 'Anonymous'}, Date: ${r.createdAt}`);
    });
} else {
    console.log('\n⚠️  No reaction data found in database.');
}

// Check pastes
const pasteCount = db.prepare('SELECT COUNT(*) as count FROM pastes').get();
console.log(`\n📄 Total Pastes: ${pasteCount.count}`);

// Show pastes with reaction counts
const pastes = db.prepare(`
    SELECT 
        p.id, 
        p.title,
        (SELECT COUNT(*) FROM paste_reactions WHERE pasteId = p.id AND type = 'heart') as hearts,
        (SELECT COUNT(*) FROM paste_reactions WHERE pasteId = p.id AND type = 'star') as stars,
        (SELECT COUNT(*) FROM paste_reactions WHERE pasteId = p.id AND type = 'fire') as fires
    FROM pastes p
    ORDER BY p.createdAt DESC
    LIMIT 10
`).all();

console.log('\n📊 Paste Reaction Summary:');
pastes.forEach(p => {
    console.log(`  ${p.title || 'Untitled'} (${p.id}): ❤️  ${p.hearts} | ⭐ ${p.stars} | 🔥 ${p.fires}`);
});

db.close();
