// Database inspection - output to file
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const db = new Database(path.join(dataDir, 'database.sqlite'));

let output = '=== DATABASE INSPECTION ===\n\n';

// Count reactions
const reactionCount = db.prepare('SELECT COUNT(*) as count FROM paste_reactions').get();
output += `Total Reactions: ${reactionCount.count}\n\n`;

// Show ALL reactions if they exist
if (reactionCount.count > 0) {
    const allReactions = db.prepare('SELECT * FROM paste_reactions ORDER BY createdAt DESC').all();
    output += `All Reactions:\n`;
    allReactions.forEach(r => {
        output += `  ID: ${r.id}, Paste: ${r.pasteId}, Type: ${r.type}, User: ${r.username || 'Anon'}\n`;
    });
} else {
    output += 'NO REACTION DATA FOUND - Database was likely cleared.\n';
}

output += '\n=== PASTE SUMMARY ===\n';
const pastes = db.prepare('SELECT id, title FROM pastes').all();
pastes.forEach(p => {
    const hearts = db.prepare('SELECT COUNT(*) as c FROM paste_reactions WHERE pasteId = ? AND type = "heart"').get(p.id).c;
    const stars = db.prepare('SELECT COUNT(*) as c FROM paste_reactions WHERE pasteId = ? AND type = "star"').get(p.id).c;
    const fires = db.prepare('SELECT COUNT(*) as c FROM paste_reactions WHERE pasteId = ? AND type = "fire"').get(p.id).c;
    output += `${p.title}: Hearts=${hearts}, Stars=${stars}, Fires=${fires}\n`;
});

db.close();

// Write to file
fs.writeFileSync(path.join(__dirname, 'reaction-report.txt'), output);
console.log('Report written to scripts/reaction-report.txt');
console.log(output);
