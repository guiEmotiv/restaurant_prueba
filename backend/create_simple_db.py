#!/usr/bin/env python
"""
Simple script to create a working SQLite database for the printer API
"""
import sqlite3
import os
from datetime import datetime

def create_database():
    db_path = 'restaurant.local.sqlite3'
    
    # Remove existing database
    if os.path.exists(db_path):
        os.remove(db_path)
        print("🗑️ Removed existing database")
    
    # Create new database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("🔨 Creating essential tables...")
    
    # Create Django's required tables
    cursor.execute('''
        CREATE TABLE django_migrations (
            id INTEGER PRIMARY KEY,
            app VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            applied DATETIME NOT NULL
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE auth_user (
            id INTEGER PRIMARY KEY,
            username VARCHAR(150) UNIQUE NOT NULL,
            first_name VARCHAR(30),
            last_name VARCHAR(150),
            email VARCHAR(254),
            is_staff BOOLEAN DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            is_superuser BOOLEAN DEFAULT 0,
            last_login DATETIME,
            date_joined DATETIME,
            password VARCHAR(128)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE django_content_type (
            id INTEGER PRIMARY KEY,
            app_label VARCHAR(100) NOT NULL,
            model VARCHAR(100) NOT NULL,
            UNIQUE(app_label, model)
        )
    ''')
    
    # Create printer tables
    cursor.execute('''
        CREATE TABLE operation_printerconfig (
            id INTEGER PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            usb_port VARCHAR(50) UNIQUE NOT NULL,
            device_path VARCHAR(255) NOT NULL,
            is_active BOOLEAN DEFAULT 0,
            max_retry_attempts INTEGER DEFAULT 3,
            timeout_seconds INTEGER DEFAULT 10,
            baud_rate INTEGER DEFAULT 9600,
            paper_width_mm INTEGER DEFAULT 80,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            last_used_at DATETIME
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE operation_printqueue (
            id INTEGER PRIMARY KEY,
            job_uuid VARCHAR(36) UNIQUE NOT NULL,
            printer_config_id INTEGER NOT NULL,
            label_content TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            priority INTEGER DEFAULT 5,
            attempt_count INTEGER DEFAULT 0,
            max_attempts INTEGER DEFAULT 3,
            created_at DATETIME NOT NULL,
            started_at DATETIME,
            completed_at DATETIME,
            next_retry_at DATETIME,
            success_message TEXT,
            error_message TEXT,
            last_error TEXT,
            order_id INTEGER,
            order_item_id INTEGER,
            created_by_id INTEGER,
            FOREIGN KEY (printer_config_id) REFERENCES operation_printerconfig (id)
        )
    ''')
    
    # Insert migration records
    now = datetime.now().isoformat()
    migrations = [
        ('contenttypes', '0001_initial'),
        ('auth', '0001_initial'),
        ('sessions', '0001_initial'),
        ('admin', '0001_initial'),
        ('operation', '0053_printerconfig_printqueue_delete_printjob_and_more')
    ]
    
    for app, name in migrations:
        cursor.execute('INSERT INTO django_migrations (app, name, applied) VALUES (?, ?, ?)',
                      (app, name, now))
    
    # Insert content types for printer models
    cursor.execute('INSERT INTO django_content_type (app_label, model) VALUES (?, ?)',
                  ('operation', 'printerconfig'))
    cursor.execute('INSERT INTO django_content_type (app_label, model) VALUES (?, ?)',
                  ('operation', 'printqueue'))
    
    conn.commit()
    conn.close()
    
    print("✅ Database created successfully!")
    print("✅ Printer tables are ready")
    print("✅ Migration records added")
    
if __name__ == '__main__':
    create_database()