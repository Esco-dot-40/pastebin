/**
 * AUTOMATIC BACKUP SERVICE
 * Runs daily backups automatically and manages old backups
 * Keeps last 30 days of backups, plus weekly backups for 3 months
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'data');
const backupDir = path.join(__dirname, '..', 'backups');
const dbPath = path.join(dataDir, 'database.sqlite');

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

function performBackup() {
    try {
        if (!fs.existsSync(dbPath)) {
            console.warn('⚠️  Database not found, skipping backup');
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const backupFilename = `auto-backup-${timestamp}.sqlite`;
        const backupPath = path.join(backupDir, backupFilename);

        // Create backup
        fs.copyFileSync(dbPath, backupPath);

        // Verify
        const originalSize = fs.statSync(dbPath).size;
        const backupSize = fs.statSync(backupPath).size;

        if (originalSize === backupSize) {
            console.log(`✅ [${new Date().toISOString()}] Auto-backup created: ${backupFilename} (${(backupSize / 1024).toFixed(2)} KB)`);
            cleanupOldBackups();
        } else {
            console.error('❌ Auto-backup verification failed');
            fs.unlinkSync(backupPath);
        }
    } catch (error) {
        console.error('❌ Auto-backup failed:', error.message);
    }
}

function cleanupOldBackups() {
    try {
        const backups = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('auto-backup-') && f.endsWith('.sqlite'))
            .map(f => ({
                name: f,
                path: path.join(backupDir, f),
                time: fs.statSync(path.join(backupDir, f)).mtime
            }))
            .sort((a, b) => b.time - a.time);

        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const thirtyDays = 30 * oneDay;
        const ninetyDays = 90 * oneDay;

        let deleted = 0;

        backups.forEach((backup, index) => {
            const age = now - backup.time;
            const isRecent = age < thirtyDays; // Keep all backups from last 30 days
            const isWeekly = index % 7 === 0; // Keep every 7th backup as weekly
            const isOld = age > ninetyDays; // Delete anything older than 90 days

            if (isOld || (!isRecent && !isWeekly)) {
                fs.unlinkSync(backup.path);
                deleted++;
            }
        });

        if (deleted > 0) {
            console.log(`🗑️  Cleaned up ${deleted} old backup(s). Remaining: ${backups.length - deleted}`);
        }
    } catch (error) {
        console.error('⚠️  Backup cleanup warning:', error.message);
    }
}

function startAutoBackup() {
    console.log('🚀 Auto-backup service started');
    console.log('📅 Schedule: Daily at 3:00 AM');
    console.log('💾 Backup directory:', backupDir);

    // Run daily at 3:00 AM
    cron.schedule('0 3 * * *', () => {
        console.log('\n⏰ Running scheduled backup...');
        performBackup();
    });

    // Also do an immediate backup on startup
    setTimeout(() => {
        console.log('\n📦 Running startup backup...');
        performBackup();
    }, 5000);
}

export { startAutoBackup, performBackup };
