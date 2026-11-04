#!/bin/bash

# Site Cleanup and Organization Script
# This script cleans up unused files and organizes the folder structure

echo "🧹 Starting Site Cleanup..."
echo "=========================================="

cd "$(dirname "$0")"

# Create archive directory if it doesn't exist
mkdir -p archive/old-pages

echo ""
echo "📂 Moving old/unused files to archive..."

# Move old specific user pages to archive
OLD_PAGES=(
    "braindamge101.html"
    "nenyoo.html"
    "riptide344TRFVDV5key.html"
    "scoobyontop.html"
    "scoobyontop2.html"
    "yim.html"
)

for page in "${OLD_PAGES[@]}"; do
    if [ -f "$page" ]; then
        mv "$page" archive/old-pages/
        echo "✅ Moved: $page → archive/old-pages/"
    fi
done

# Move utility/test files
UTIL_FILES=(
    "carousel-example.html"
    "update-youtube-links.html"
    "help-backup.html"
)

for file in "${UTIL_FILES[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" archive/old-pages/
        echo "✅ Moved: $file → archive/old-pages/"
    fi
done

echo ""
echo "📊 Creating redirects for moved pages..."

# Create redirect file for old profile.html -> profile.html (now contact page)
cat > archive/old-pages/README.md << 'EOF'
# Archived Pages

This folder contains old, unused, or deprecated pages from the website.

## Contents:
- **braindamge101.html** - Old user-specific page
- **nenyoo.html** - Old cheat-specific page
- **riptide344TRFVDV5key.html** - Old key page
- **scoobyontop.html** - Old user page
- **scoobyontop2.html** - Old user page version 2
- **yim.html** - Old YimMenu page (moved to /games/gta/)
- **carousel-example.html** - Development test file
- **update-youtube-links.html** - Utility script
- **help-backup.html** - Backup of help page

These files are kept for reference but are no longer linked in the active site.
EOF

echo ""
echo "📋 Checking for broken script references..."

# Check main pages for missing script files
MAIN_PAGES=("index.html" "youtube.html" "profile.html" "help.html")

for page in "${MAIN_PAGES[@]}"; do
    if [ -f "$page" ]; then
        echo ""
        echo "Checking: $page"

        # Extract script sources
        grep -o 'src="[^"]*\.js"' "$page" | sed 's/src="//g' | sed 's/"//g' | while read script; do
            if [ ! -f "$script" ]; then
                echo "  ⚠️  Missing: $script"
            else
                echo "  ✅ Found: $script"
            fi
        done
    fi
done

echo ""
echo "=========================================="
echo "✨ Cleanup Complete!"
echo ""
echo "Summary:"
echo "- ✅ Old pages moved to archive/old-pages/"
echo "- ✅ Created archive README.md"
echo "- ✅ Verified script references"
echo ""
echo "Current structure:"
echo "  📁 Root: Core pages (index, youtube, profile, help, safety)"
echo "  📁 /games: All game-specific content"
echo "  📁 /console: Console gaming (PS3, Xbox 360, emulators)"
echo "  📁 /tools: Development tools, injectors, sources"
echo "  📁 /assets: CSS, JS, images"
echo "  📁 /archive: Archived/deprecated content"
echo "  📁 /backup: Full site backups"
echo ""
