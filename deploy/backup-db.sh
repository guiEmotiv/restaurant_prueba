#!/bin/bash

# Database backup script for RDS PostgreSQL

set -e

# Configuration from environment variables
RDS_HOSTNAME=${RDS_HOSTNAME}
RDS_USERNAME=${RDS_USERNAME}
RDS_PASSWORD=${RDS_PASSWORD}
RDS_DB_NAME=${RDS_DB_NAME}
BACKUP_DIR="/opt/restaurant-app/backups"
S3_BACKUP_BUCKET=${S3_BACKUP_BUCKET:-"${AWS_S3_BUCKET_NAME}-backups"}

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="restaurant_db_backup_${TIMESTAMP}.sql"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

echo "Starting database backup..."

# Create database backup
PGPASSWORD=$RDS_PASSWORD pg_dump \
    -h $RDS_HOSTNAME \
    -U $RDS_USERNAME \
    -d $RDS_DB_NAME \
    -f $BACKUP_PATH \
    --verbose

# Compress backup
echo "Compressing backup..."
gzip $BACKUP_PATH
BACKUP_PATH="${BACKUP_PATH}.gz"

# Upload to S3 if bucket is configured
if [ ! -z "$S3_BACKUP_BUCKET" ]; then
    echo "Uploading backup to S3..."
    aws s3 cp $BACKUP_PATH s3://$S3_BACKUP_BUCKET/db-backups/
    echo "Backup uploaded to S3: s3://$S3_BACKUP_BUCKET/db-backups/$(basename $BACKUP_PATH)"
fi

# Keep only last 7 local backups
echo "Cleaning old local backups..."
find $BACKUP_DIR -name "restaurant_db_backup_*.sql.gz" -type f -mtime +7 -delete

echo "Database backup completed: $BACKUP_PATH"