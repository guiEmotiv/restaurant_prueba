#!/usr/bin/env python
# Quick debug script to find assets in container
import os
import glob

print("=== DEBUGGING ASSETS LOCATION ===")
print()

# Check basic directories
dirs_to_check = ['/app', '/app/frontend_static', '/app/staticfiles']
for directory in dirs_to_check:
    if os.path.exists(directory):
        print(f"✅ {directory} exists")
        try:
            files = os.listdir(directory)[:10]
            print(f"   Files: {files}")
        except:
            print(f"   Error reading directory")
    else:
        print(f"❌ {directory} does not exist")
    print()

# Search for specific files
search_patterns = [
    '/app/**/*index-dsb0hPYX*',
    '/app/**/*index-BCaE9ebp*', 
    '/app/**/*vite.svg*',
    '/app/**/*.css',
    '/app/**/*.js'
]

for pattern in search_patterns:
    print(f"Searching: {pattern}")
    try:
        matches = glob.glob(pattern, recursive=True)
        print(f"   Found: {matches}")
    except Exception as e:
        print(f"   Error: {e}")
    print()