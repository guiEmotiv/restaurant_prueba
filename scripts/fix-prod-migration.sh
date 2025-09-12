#!/bin/bash

echo "🔧 Fixing production migration issue..."
echo "================================================"

# SSH connection details
SSH_KEY="ubuntu_fds_key.pem"
SERVER_IP="44.248.47.186"
SERVER_USER="ubuntu"

# Create Python script to fake the migration
cat << 'EOF' > /tmp/fake_migration.py
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # Mark the problematic migration as already applied
    cursor.execute("""
        INSERT INTO django_migrations (app, name, applied)
        VALUES ('operation', '0002_printerconfig_printqueue', datetime('now'))
    """)
    print("✅ Marked operation.0002_printerconfig_printqueue as applied")
    
    # Apply remaining migrations
    from django.core.management import call_command
    call_command('migrate', '--fake-initial')
    print("✅ Applied remaining migrations")
EOF

# Copy script to server
echo "📋 Copying fix script to server..."
scp -i $SSH_KEY /tmp/fake_migration.py $SERVER_USER@$SERVER_IP:/tmp/

# Execute fix inside container
echo "🚀 Executing fix in container..."
ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP << 'REMOTE_COMMANDS'
cd /home/ubuntu/restaurant-web

# Copy script into container
/usr/bin/docker cp /tmp/fake_migration.py restaurant-web-backend-prod:/tmp/

# Execute the fix
/usr/bin/docker exec restaurant-web-backend-prod python /tmp/fake_migration.py

# Restart containers
echo "🔄 Restarting containers..."
/usr/bin/docker compose -f docker-compose.production.yml restart

echo "✅ Fix applied!"
REMOTE_COMMANDS

echo "🎉 Production migration issue fixed!"