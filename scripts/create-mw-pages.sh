#!/bin/bash

# Script to create separate Modern Warfare game pages
# This creates individual pages for MW2 2009, MW3 2011, MW 2019, MW2 2022, and MW3 2023

echo "Creating Modern Warfare individual game pages..."

# Note: This is a placeholder script.
# The actual page creation will be done manually to ensure proper content for each game.

# What this script WOULD do:
# 1. Read modern-warfare.html template
# 2. Extract MW2 2009 section -> create cod-mw2-2009.html
# 3. Extract MW3 2011 section -> create cod-mw3-2011.html
# 4. Read mw2019.html template
# 5. Split into cod-mw-2019.html, cod-mw2-2022.html, cod-mw3-2023.html
# 6. Update each with appropriate cover art
# 7. Update COD index.html to link to all new pages

echo "Pages to be created:"
echo "- games/cod/mw2-2009.html (Modern Warfare 2, 2009)"
echo "- games/cod/mw3-2011.html (Modern Warfare 3, 2011)"
echo "- games/cod/mw-2019.html (Modern Warfare, 2019)"
echo "- games/cod/mw2-2022.html (Modern Warfare II, 2022)"
echo "- games/cod/mw3-2023.html (Modern Warfare III, 2023)"

echo ""
echo "Cover art available:"
ls -lh assets/images/covers/cod-mw*.jpg

echo ""
echo "Note: Pages will be created manually with proper cheat listings for each game"
