# Database Backup System

## Overview
Automated and manual backup system for the SQLite database with retention policies and safety features.

## Features
- ✅ **Automatic Daily Backups** - Runs at 3:00 AM every day
- ✅ **Manual Backup Script** - Run on-demand before risky changes
- ✅ **Safe Restore** - Automatic safety backup before restore
- ✅ **Smart Retention** - Keeps 30 days + weekly backups for 90 days
- ✅ **Automatic Cleanup** - Manages disk space by removing old backups

## Quick Start

### Manual Backup (Before Making Changes)
```bash
# Create a backup with current timestamp
node scripts/backup-database.js

# Create a backup with custom name
node scripts/backup-database.js before-major-update
```

### List Available Backups
```bash
node scripts/restore-database.js
```

### Restore from Backup
```bash
# This will list backups first, then:
node scripts/restore-database.js <backup-filename>

# Example:
node scripts/restore-database.js auto-backup-2026-01-25T15-30-00.sqlite
```

## Automatic Backup Schedule

The automatic backup service is integrated into the main server and runs:
- **Daily at 3:00 AM** (server time)
- **On server startup** (5 seconds after start)

### Retention Policy
- **Last 30 days**: All daily backups kept
- **30-90 days**: Weekly backups only (every 7th backup)
- **90+ days**: Automatically deleted

## Backup Locations

### Development
```
backups/
├── auto-backup-2026-01-25T03-00-00.sqlite
├── auto-backup-2026-01-24T03-00-00.sqlite
├── database-backup-2026-01-25T14-30-00-before-update.sqlite
└── pre-restore-safety-1737835200000.sqlite
```

### Production (Railway)
Backups are stored in the persistent volume at:
```
$RAILWAY_VOLUME_MOUNT_PATH/backups/
```

## Safety Features

### Pre-Restore Safety Backup
Every restore operation automatically creates a safety backup:
```bash
node scripts/restore-database.js old-backup.sqlite
# Creates: pre-restore-safety-<timestamp>.sqlite
```

### Automatic Rollback
If restore verification fails, the system automatically rolls back to the safety backup.

## Monitoring

Check backup status in server logs:
```
✅ [2026-01-25T03:00:00.000Z] Auto-backup created: auto-backup-2026-01-25T03-00-00.sqlite (88.25 KB)
🗑️  Cleaned up 3 old backup(s). Remaining: 27
```

## Troubleshooting

### "Database locked" Error
If you get a database locked error:
1. Stop the server
2. Run the backup/restore script
3. Restart the server

### Missing Backups Directory
The backup directory is automatically created on first backup.

### Disk Space Issues
The automatic cleanup runs after each backup. Manual cleanup:
```bash
# Delete backups older than 90 days manually
find backups/ -name "auto-backup-*.sqlite" -mtime +90 -delete
```

## Best Practices

1. **Before Database Schema Changes**
   ```bash
   node scripts/backup-database.js before-schema-migration
   ```

2. **Before Bulk Deletions**
   ```bash
   node scripts/backup-database.js before-cleanup
   ```

3. **Regular Testing**
   - Test restore process monthly
   - Verify backup file integrity

4. **Off-site Backups**
   - Consider copying backups to external storage
   - Railway provides volume snapshots

## Example Workflow

### Making Risky Changes
```bash
# 1. Create manual backup
node scripts/backup-database.js before-danger

# 2. Make your changes
# ... dangerous operations ...

# 3. If something goes wrong, restore:
node scripts/restore-database.js backup-before-danger.sqlite
```

## Configuration

Edit `server/services/auto-backup.js` to customize:

```javascript
// Change backup time (currently 3:00 AM)
cron.schedule('0 3 * * *', () => { ... });

// Change retention (currently 30/90 days)
const thirtyDays = 30 * oneDay;
const ninetyDays = 90 * oneDay;
```

## Notes

- Backups are SQLite database files - can be opened with any SQLite browser
- Filename format: `auto-backup-YYYY-MM-DDTHH-MM-SS.sqlite`
- Manual backups: `database-backup-YYYY-MM-DDTHH-MM-SS-<name>.sqlite`
- Safety backups: `pre-restore-safety-<timestamp>.sqlite`
