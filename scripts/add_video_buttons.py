import re
import os

# List of game pages to update
game_pages = [
    r"C:\Users\whatw\Documents\GitHub\whatwhatboyy.github.io\games\apex\index.html",
    r"C:\Users\whatw\Documents\GitHub\whatwhatboyy.github.io\games\battlefield\index.html",
    r"C:\Users\whatw\Documents\GitHub\whatwhatboyy.github.io\games\cod\index.html",
    r"C:\Users\whatw\Documents\GitHub\whatwhatboyy.github.io\games\counter-strike\index.html",
    r"C:\Users\whatw\Documents\GitHub\whatwhatboyy.github.io\games\cs16\index.html",
    r"C:\Users\whatw\Documents\GitHub\whatwhatboyy.github.io\games\csgo\index.html",
    r"C:\Users\whatw\Documents\GitHub\whatwhatboyy.github.io\games\css\index.html",
    r"C:\Users\whatw\Documents\GitHub\whatwhatboyy.github.io\games\farlight84\index.html",
    r"C:\Users\whatw\Documents\GitHub\whatwhatboyy.github.io\games\fortnite\index.html",
    r"C:\Users\whatw\Documents\GitHub\whatwhatboyy.github.io\games\gmod\index.html",
    r"C:\Users\whatw\Documents\GitHub\whatwhatboyy.github.io\games\gta\index.html",
    r"C:\Users\whatw\Documents\GitHub\whatwhatboyy.github.io\games\left4dead\index.html",
    r"C:\Users\whatw\Documents\GitHub\whatwhatboyy.github.io\games\other\index.html",
    r"C:\Users\whatw\Documents\GitHub\whatwhatboyy.github.io\games\rdr2\index.html",
    r"C:\Users\whatw\Documents\GitHub\whatwhatboyy.github.io\games\rust\index.html",
    r"C:\Users\whatw\Documents\GitHub\whatwhatboyy.github.io\games\tf2\index.html",
    r"C:\Users\whatw\Documents\GitHub\whatwhatboyy.github.io\games\valorant\index.html",
]

video_button_html = '''                            <a href="https://www.youtube.com/@whatwhatboy98" class="btn btn-outline" target="_blank">
                                <i class="fab fa-youtube"></i>
                                Video
                            </a>'''

total_updates = 0

for page in game_pages:
    if not os.path.exists(page):
        print(f"Skipping {page} - file not found")
        continue

    with open(page, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern to find Download buttons that are NOT followed by a Video button
    # This looks for Download </a> followed by </div> (cheat-actions closing)
    # but NOT followed by another <a> tag (which would be the video button)
    pattern = r'(<a href="[^"]*" class="btn btn-primary"[^>]*>\s*<i class="fas fa-download"></i>\s*Download\s*</a>)\s*(</div>\s*</div>)'

    # Check if there are any matches
    matches = list(re.finditer(pattern, content))

    if matches:
        # Replace: add the video button before the closing </div></div>
        replacement = r'\1\n' + video_button_html + r'\n                        \2'
        new_content = re.sub(pattern, replacement, content)

        # Write back
        with open(page, 'w', encoding='utf-8') as f:
            f.write(new_content)

        game_name = os.path.basename(os.path.dirname(page))
        print(f"Updated {game_name}: {len(matches)} video buttons added")
        total_updates += len(matches)
    else:
        game_name = os.path.basename(os.path.dirname(page))
        print(f"{game_name}: No updates needed")

print(f"\nTotal: {total_updates} video buttons added across all pages")
