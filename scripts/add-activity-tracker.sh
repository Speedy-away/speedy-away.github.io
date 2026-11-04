#!/bin/bash

# Activity Tracker Auto-Apply Script
# Adds activity-tracker.js to all HTML files

echo "🎯 Adding Activity Tracker to all pages..."
echo "=========================================="

cd "$(dirname "$0")"
count=0

# Find all HTML files and add activity-tracker.js if not already present
for file in $(find . -name "*.html" -not -path "./node_modules/*" -not -path "./.git/*"); do
    # Check if file already has activity-tracker.js
    if grep -q "activity-tracker.js" "$file"; then
        echo "⏭️  Skipping $file (already has activity-tracker.js)"
    else
        # Check if file has a closing </body> tag
        if grep -q "</body>" "$file"; then
            # Add activity-tracker.js before site-enhancements.js or before </body>
            if grep -q "site-enhancements.js" "$file"; then
                sed -i 's|<script src="assets/js/site-enhancements.js"></script>|<script src="assets/js/activity-tracker.js"></script>\n    <script src="assets/js/site-enhancements.js"></script>|' "$file"
            else
                sed -i 's|</body>|    <script src="assets/js/activity-tracker.js"></script>\n</body>|' "$file"
            fi
            echo "✅ Updated: $file"
            ((count++))
        else
            echo "⚠️  Warning: $file doesn't have </body> tag, skipping..."
        fi
    fi
done

echo ""
echo "=========================================="
echo "✨ Activity tracker added!"
echo "📊 Updated $count file(s)"
echo ""
echo "The Recent Activity feed now:"
echo "- ✅ Tracks real user actions"
echo "- ✅ Persists activities in localStorage"
echo "- ✅ Shows time-stamped events"
echo "- ✅ Updates in real-time"
echo "- ✅ Displays activity icons"
echo ""
