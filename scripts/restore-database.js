#!/usr/bin/env node
/**
 * DATABASE RESTORE SCRIPT
 * Restore database from a backup file
 * Usage: node scripts/restore-database.js <backup-filename>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'data');
const backupDir = path.join(__dirname, '..', 'backups');
const dbPath = path.join(dataDir, 'database.sqlite');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function listBackups() {
    if (!fs.existsSync(backupDir)) {
        console.log('❌ No backups directory found');
        return [];
    }

    const backups = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.sqlite'))
        .map(f => ({
            name: f,
            path: path.join(backupDir, f),
            size: fs.statSync(path.join(backupDir, f)).size,
            time: fs.statSync(path.join(backupDir, f)).mtime
        }))
        .sort((a, b) => b.time - a.time);

    return backups;
}

async function confirmRestore() {
    return new Promise((resolve) => {
        rl.question('⚠️  This will REPLACE your current database. Are you sure? (yes/no): ', (answer) => {
            resolve(answer.toLowerCase() === 'yes');
        });
    });
}

async function main() {
    const backupFile = process.argv[2];

    console.log('\n📂 DATABASE RESTORE UTILITY\n');

    if (!backupFile) {
        console.log('Available backups:\n');
        const backups = listBackups();

        if (backups.length === 0) {
            console.log('❌ No backups found');
            process.exit(1);
        }

        backups.forEach((b, i) => {
            console.log(`${i + 1}. ${b.name}`);
            console.log(`   Size: ${(b.size / 1024).toFixed(2)} KB`);
            console.log(`   Date: ${b.time.toLocaleString()}\n`);
        });

        console.log('Usage: node scripts/restore-database.js <backup-filename>');
        process.exit(0);
    }

    const backupPath = path.join(backupDir, backupFile);

    if (!fs.existsSync(backupPath)) {
        console.error(`❌ Backup file not found: ${backupFile}`);
        process.exit(1);
    }

    // Create a safety backup of current database
    const safetyBackupName = `pre-restore-safety-${Date.now()}.sqlite`;
    const safetyBackupPath = path.join(backupDir, safetyBackupName);

    console.log(`📋 Backup to restore: ${backupFile}`);
    console.log(`💾 Creating safety backup: ${safetyBackupName}`);

    const confirmed = await confirmRestore();

    if (!confirmed) {
        console.log('❌ Restore cancelled');
        rl.close();
        process.exit(0);
    }

    try {
        // Create safety backup
        if (fs.existsSync(dbPath)) {
            fs.copyFileSync(dbPath, safetyBackupPath);
            console.log('✅ Safety backup created');
        }

        // Restore from backup
        fs.copyFileSync(backupPath, dbPath);

        // Verify
        const backupSize = fs.statSync(backupPath).size;
        const restoredSize = fs.statSync(dbPath).size;

        if (backupSize === restoredSize) {
            console.log('✅ Database restored successfully!');
            console.log(`📍 Restored from: ${backupFile}`);
            console.log(`🛡️  Safety backup: ${safetyBackupName}`);
        } else {
            console.error('❌ Restore verification failed!');
            console.log('⚠️  Attempting to restore from safety backup...');
            fs.copyFileSync(safetyBackupPath, dbPath);
            console.log('✅ Rolled back to previous state');
        }
    } catch (error) {
        console.error('❌ Restore failed:', error.message);
        if (fs.existsSync(safetyBackupPath)) {
            console.log('⚠️  Attempting rollback from safety backup...');
            fs.copyFileSync(safetyBackupPath, dbPath);
        }
    }

    rl.close();
}

main();
