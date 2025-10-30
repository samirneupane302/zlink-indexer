#!/bin/bash


if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

chain_id="$CHAIN_ID"
mongodb_uri="$MONGODB_URI"

if [ -z "$chain_id" ]; then
    echo "CHAIN_ID is not set"
    exit 1
fi

if [ -z "$mongodb_uri" ]; then
    echo "MONGODB_URI is not set"
    exit 1
fi

echo "Creating a zlink-indexer backup"
echo "Backing up zlink-index-${chain_id} database"
mkdir -p backups/zlink-index-${chain_id}
mongodump --uri=${mongodb_uri} --authenticationDatabase=admin --db=zlink-index-${chain_id} --out="backups/zlink-index-${chain_id}"

#delete the old backup
rm -rf backups/zlink-index-${chain_id}-*.zip

#compress the backup to a zip file with the current date and time
zip -r backups/zlink-index-${chain_id}-$(date +%m-%d-%Y).zip backups/zlink-index-${chain_id}

#remove the backup directory
rm -rf backups/zlink-index-${chain_id}

echo "Backup completed successfully"
echo "Backup file: backups/zlink-index-${chain_id}-$(date +%m-%d-%Y).zip"
