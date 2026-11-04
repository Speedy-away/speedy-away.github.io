#!/bin/bash

# Update all navigation references from "Profile" to "Contact Info"

echo "🔄 Updating navigation: Profile → Contact Info"
echo "==============================================="

cd "$(dirname "$0")"
count=0

# Find and update all HTML files (excluding backups and archives)
for file in $(find . -name "*.html" -type f ! -path "*/backup/*" ! -path "*/archive/*" ! -path "*/.git/*"); do
    # Check if file contains the old Profile navigation
    if grep -q 'fas fa-user.*Profile\|<span>Profile</span>' "$file" 2>/dev/null; then
        # Update the icon and text
        sed -i 's|<i class="fas fa-user"></i>\s*<span>Profile</span>|<i class="fas fa-address-card"></i>\n                    <span>Contact Info</span>|g' "$file"

        # Alternative pattern
        sed -i 's|fas fa-user.*\n.*Profile|fas fa-address-card"></i>\n                    <span>Contact Info|g' "$file"

        echo "✅ Updated: $file"
        ((count++))
    fi
done

echo ""
echo "==============================================="
echo "✨ Navigation updated!"
echo "📊 Updated $count file(s)"
echo ""
echo "All pages now show 'Contact Info' instead of 'Profile'"
