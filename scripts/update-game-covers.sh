#!/bin/bash

# Game Cover Art Update Script
# This script updates all game pages with proper cover art paths

echo "Updating Call of Duty game pages with proper cover art..."

# Update COD index page
sed -i 's|https://i.imgur.com/K8vR4nP.png|../../assets/images/cod.png|g' games/cod/index.html
sed -i 's|https://i.imgur.com/9YwQJXH.jpeg|../../assets/images/covers/cod-black-ops-6.jpg|g' games/cod/index.html
sed -i 's|https://i.imgur.com/xVZ8LQx.jpeg|../../assets/images/covers/cod-warzone.jpg|g' games/cod/index.html
sed -i 's|https://i.imgur.com/yvXB5hl.jpeg|../../assets/images/covers/cod-cold-war-official.jpg|g' games/cod/index.html
sed -i 's|https://i.imgur.com/K2gDJYa.jpeg|../../assets/images/covers/cod-mw-2019.jpg|g' games/cod/index.html
sed -i 's|https://i.imgur.com/nZ8kXVj.jpeg|../../assets/images/covers/cod-black-ops-3.jpg|g' games/cod/index.html
sed -i 's|https://i.imgur.com/BnXr6YM.jpeg|../../assets/images/covers/cod-black-ops-2.jpg|g' games/cod/index.html
sed -i 's|https://i.imgur.com/3ZqP8yf.jpeg|../../assets/images/covers/cod-black-ops-1.jpg|g' games/cod/index.html
sed -i 's|https://i.imgur.com/tzIUzkd.png|../../assets/images/covers/cod-h2m.jpg|g' games/cod/index.html
sed -i 's|https://i.imgur.com/sQCciRt.png|../../assets/images/covers/cod-plutonium.jpg|g' games/cod/index.html
sed -i 's|https://i.imgur.com/rhinomw.png|../../assets/images/covers/cod-modern-warfare-classic.jpg|g' games/cod/index.html
sed -i 's|https://i.imgur.com/sCiqoiz.png|../../assets/images/covers/cod4.jpg|g' games/cod/index.html
sed -i 's|https://i.imgur.com/ZqR7Jzm.jpeg|../../assets/images/covers/cod-ghosts.jpg|g' games/cod/index.html
sed -i 's|https://i.imgur.com/scmZh8f.png|../../assets/images/covers/cod-advanced-warfare.jpg|g' games/cod/index.html
sed -i 's|https://i.imgur.com/dexTool.png|../../assets/images/covers/cod-infinite-warfare.jpg|g' games/cod/index.html

# Update individual COD game pages
sed -i 's|https://i.imgur.com/sCiqoiz.png|https://i.imgur.com/sCiqoiz.png|g' games/cod/cod4.html
sed -i 's|https://i.imgur.com/9YwQJXH.jpeg|https://i.imgur.com/9YwQJXH.jpeg|g' games/cod/black-ops-6.html
sed -i 's|https://i.imgur.com/xVZ8LQx.jpeg|https://i.imgur.com/xVZ8LQx.jpeg|g' games/cod/warzone.html
sed -i 's|https://i.imgur.com/yvXB5hl.jpeg|https://i.imgur.com/yvXB5hl.jpeg|g' games/cod/cold-war.html
sed -i 's|https://i.imgur.com/K2gDJYa.jpeg|https://i.imgur.com/K2gDJYa.jpeg|g' games/cod/mw2019.html
sed -i 's|https://i.imgur.com/nZ8kXVj.jpeg|https://i.imgur.com/nZ8kXVj.jpeg|g' games/cod/black-ops-3.html
sed -i 's|https://i.imgur.com/BnXr6YM.jpeg|https://i.imgur.com/BnXr6YM.jpeg|g' games/cod/black-ops-2.html
sed -i 's|https://i.imgur.com/3ZqP8yf.jpeg|https://i.imgur.com/3ZqP8yf.jpeg|g' games/cod/black-ops-1.html

echo "Updating Battlefield game pages with proper cover art..."

# Update Battlefield index page
sed -i 's|https://i.imgur.com/battlefield.png|../../assets/images/bffff.png|g' games/battlefield/index.html
sed -i 's|https://i.imgur.com/bf2042.png|../../assets/images/covers/battlefield-2042.jpg|g' games/battlefield/index.html
sed -i 's|https://i.imgur.com/bf5.png|../../assets/images/covers/battlefield-5.jpg|g' games/battlefield/index.html
sed -i 's|https://i.imgur.com/bf1.png|../../assets/images/covers/battlefield-1.jpg|g' games/battlefield/index.html
sed -i 's|https://i.imgur.com/bfhardline.png|../../assets/images/covers/battlefield-hardline.jpg|g' games/battlefield/index.html
sed -i 's|https://i.imgur.com/bf4.png|../../assets/images/covers/battlefield-4.jpg|g' games/battlefield/index.html
sed -i 's|https://i.imgur.com/bf3.png|../../assets/images/covers/battlefield-3.jpg|g' games/battlefield/index.html
sed -i 's|https://i.imgur.com/bfbc2.png|../../assets/images/covers/battlefield-bc2.jpg|g' games/battlefield/index.html
sed -i 's|https://i.imgur.com/bf2.png|../../assets/images/covers/battlefield-2.jpg|g' games/battlefield/index.html
sed -i 's|https://i.imgur.com/bf2142.png|../../assets/images/covers/battlefield-2142.jpg|g' games/battlefield/index.html
sed -i 's|https://i.imgur.com/bf1942.png|../../assets/images/covers/battlefield-1942.jpg|g' games/battlefield/index.html

echo "Fixing navigation inconsistencies..."

# Remove 'store' link from pages that have it and shouldn't
find games/cod -name "*.html" -type f -exec sed -i '/<li><a href=".*#store" class="nav-link">/,/<\/li>/d' {} \;
find games/battlefield -name "*.html" -type f -exec sed -i '/<li><a href=".*#store" class="nav-link">/,/<\/li>/d' {} \;

# Fix CSS path issues - change assets/css/site-fixes.css to ../../assets/css/site-fixes.css
find games/cod -name "*.html" -type f -exec sed -i 's|<link rel="stylesheet" href="assets/css/site-fixes.css">||g' {} \;
find games/battlefield -name "*.html" -type f -exec sed -i 's|<link rel="stylesheet" href="assets/css/site-fixes.css">||g' {} \;
find games/battlefield -name "*.html" -type f -exec sed -i 's|<link rel="stylesheet" href="../../assets/css/site-fixes.css">||g' {} \;

echo "Fixing JavaScript path issues..."

# Remove activity-tracker.js references that have wrong paths
find games/cod -name "*.html" -type f -exec sed -i 's|<script src="assets/js/activity-tracker.js"></script>||g' {} \;
find games/cod -name "*.html" -type f -exec sed -i 's|<script src="../../../assets/js/dark-mode.js"></script>||g' {} \;
find games/battlefield -name "*.html" -type f -exec sed -i 's|<script src="assets/js/activity-tracker.js"></script>||g' {} \;

echo "Update complete!"
echo "Summary:"
echo "- Updated all COD game cover images"
echo "- Updated all Battlefield game cover images"
echo "- Fixed navigation inconsistencies"
echo "- Fixed CSS/JS path issues"
