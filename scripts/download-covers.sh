#!/bin/bash

# Game Cover Art Download Script
# This script downloads official cover art for all games

COVERS_DIR="assets/images/covers"
mkdir -p "$COVERS_DIR"

echo "Downloading Call of Duty cover art..."

# COD Black Ops 6 - Use a high quality source
curl -L "https://image.api.playstation.com/vulcan/ap/rnd/202407/0122/fec6ca1f31b5b5066c2dc0c4c5ffac9a8af14c2daf716c24.png" -o "$COVERS_DIR/cod-black-ops-6.jpg" 2>/dev/null || \
echo "BO6 cover - please download manually"

# COD Warzone
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1962663/header.jpg" -o "$COVERS_DIR/cod-warzone.jpg" 2>/dev/null || \
echo "Warzone cover - please download manually"

# COD Cold War
curl -L 'https://gmedia.playstation.com/is/image/SIEPDC/call-of-duty-black-ops-cold-war-pdp-hero-01-ps4-25aug20$en?fmt=jpeg&wid=1280&qlt=85' -o "$COVERS_DIR/cod-cold-war-official.jpg" 2>/dev/null || \
echo "Cold War cover - please download manually"

# COD MW 2019
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1938090/header.jpg" -o "$COVERS_DIR/cod-mw-2019.jpg" 2>/dev/null || \
echo "MW2019 cover - please download manually"

# COD Black Ops 4
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2455130/header.jpg" -o "$COVERS_DIR/cod-black-ops-4.jpg" 2>/dev/null || \
echo "BO4 cover - please download manually"

# COD Black Ops 3
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/311210/header.jpg" -o "$COVERS_DIR/cod-black-ops-3.jpg" 2>/dev/null || \
echo "BO3 cover - please download manually"

# COD Black Ops 2
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/202970/header.jpg" -o "$COVERS_DIR/cod-black-ops-2.jpg" 2>/dev/null || \
echo "BO2 cover - please download manually"

# COD Black Ops 1
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/42700/header.jpg" -o "$COVERS_DIR/cod-black-ops-1.jpg" 2>/dev/null || \
echo "BO1 cover - please download manually"

# COD Modern Warfare 2 (2009)
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/10180/header.jpg" -o "$COVERS_DIR/cod-modern-warfare-classic.jpg" 2>/dev/null || \
echo "MW2 Classic cover - please download manually"

# COD4
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/7940/header.jpg" -o "$COVERS_DIR/cod4.jpg" 2>/dev/null || \
echo "COD4 cover - please download manually"

# COD Ghosts
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/209160/header.jpg" -o "$COVERS_DIR/cod-ghosts.jpg" 2>/dev/null || \
echo "Ghosts cover - please download manually"

# COD Advanced Warfare
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/209650/header.jpg" -o "$COVERS_DIR/cod-advanced-warfare.jpg" 2>/dev/null || \
echo "Advanced Warfare cover - please download manually"

# COD Infinite Warfare
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292730/header.jpg" -o "$COVERS_DIR/cod-infinite-warfare.jpg" 2>/dev/null || \
echo "Infinite Warfare cover - please download manually"

echo ""
echo "Downloading Battlefield cover art..."

# Battlefield 2042
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1517290/header.jpg" -o "$COVERS_DIR/battlefield-2042.jpg" 2>/dev/null || \
echo "BF2042 cover - please download manually"

# Battlefield 5
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1238810/header.jpg" -o "$COVERS_DIR/battlefield-5.jpg" 2>/dev/null || \
echo "BF5 cover - please download manually"

# Battlefield 1
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1238840/header.jpg" -o "$COVERS_DIR/battlefield-1.jpg" 2>/dev/null || \
echo "BF1 cover - please download manually"

# Battlefield Hardline
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1238880/header.jpg" -o "$COVERS_DIR/battlefield-hardline.jpg" 2>/dev/null || \
echo "BF Hardline cover - please download manually"

# Battlefield 4
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1238860/header.jpg" -o "$COVERS_DIR/battlefield-4.jpg" 2>/dev/null || \
echo "BF4 cover - please download manually"

# Battlefield 3
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1238820/header.jpg" -o "$COVERS_DIR/battlefield-3.jpg" 2>/dev/null || \
echo "BF3 cover - please download manually"

# Battlefield Bad Company 2
curl -L "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/24960/header.jpg" -o "$COVERS_DIR/battlefield-bc2.jpg" 2>/dev/null || \
echo "BF BC2 cover - please download manually"

echo ""
echo "Creating placeholder logos for clients..."

# H2M and Plutonium use text-based placeholders for now
echo "H2M" > "$COVERS_DIR/cod-h2m.txt"
echo "Plutonium" > "$COVERS_DIR/cod-plutonium.txt"

echo ""
echo "Download complete! Check the covers directory."
echo "Some images may need to be downloaded manually - see COVER_ART_SOURCES.md"

chmod +x "$0"
