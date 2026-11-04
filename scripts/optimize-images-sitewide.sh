#!/bin/bash

# Script to optimize all images across the site
# Adds lazy loading and image optimization to all HTML files

echo "Starting site-wide image optimization..."

# Find all HTML files
html_files=$(find /c/Users/whatw/Documents/GitHub/whatwhatboyy.github.io -name "*.html" -type f ! -path "*/backup/*" ! -path "*/node_modules/*")

count=0

for file in $html_files; do
    echo "Processing: $file"

    # Add image optimization CSS if not already present
    if ! grep -q "image-optimization.css" "$file"; then
        # Find the last CSS link and add after it
        if grep -q "\.css" "$file"; then
            # Calculate relative path to assets
            depth=$(echo "$file" | sed 's|/c/Users/whatw/Documents/GitHub/whatwhatboyy.github.io/||' | grep -o '/' | wc -l)
            rel_path=""
            for ((i=0; i<depth; i++)); do
                rel_path="../$rel_path"
            done

            # If file is in root, no relative path needed
            if [ $depth -eq 0 ]; then
                rel_path=""
            fi

            sed -i "/<\/head>/i \\    <link rel=\"stylesheet\" href=\"${rel_path}assets/css/image-optimization.css\">" "$file"
        fi
    fi

    # Add image optimizer JS if not already present
    if ! grep -q "image-optimizer.js" "$file"; then
        # Calculate relative path to assets
        depth=$(echo "$file" | sed 's|/c/Users/whatw/Documents/GitHub/whatwhatboyy.github.io/||' | grep -o '/' | wc -l)
        rel_path=""
        for ((i=0; i<depth; i++)); do
            rel_path="../$rel_path"
        done

        # If file is in root, no relative path needed
        if [ $depth -eq 0 ]; then
            rel_path=""
        fi

        sed -i "/<\/body>/i \\    <script src=\"${rel_path}assets/js/image-optimizer.js\"><\/script>" "$file"
    fi

    # Ensure all images have loading="lazy" except first few above-the-fold images
    # This will be handled by the JavaScript optimizer dynamically

    count=$((count + 1))
done

echo "Optimized $count HTML files"
echo "Image optimization complete!"
