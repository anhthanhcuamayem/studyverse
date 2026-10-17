import re
import sys
from pathlib import Path

BASE_DIR = Path("/home/thanh/LÀM VIỆC/project/studyverse")

errors = []
warnings = []

def check(condition, msg):
    if not condition:
        errors.append(msg)

def warn(condition, msg):
    if not condition:
        warnings.append(msg)

print("=== 1. Checking DOM structure across core pages ===")
core_pages = [
    'index.html',
    'career/chat.html',
    'flashcard/flashcard.html',
    'schedule/create.html',
    'todo/mylist.html',
]

for p in core_pages:
    content = (BASE_DIR / p).read_text(encoding='utf-8')
    check('<header class="navbar">' in content, f"{p} missing <header class=\"navbar\">")
    check('class="nav-container"' in content, f"{p} missing nav-container")
    check('class="navigation"' in content, f"{p} missing navigation")
    check('class="indicator"' in content, f"{p} missing indicator")
    for li_id in ['li-home', 'li-project', 'li-schedule', 'li-career', 'li-flashcard']:
        check(f'id="{li_id}"' in content, f"{p} missing {li_id}")

account_html = (BASE_DIR / 'account.html').read_text(encoding='utf-8')
check('class="account-topbar"' in account_html, "account.html missing account-topbar")
check('class="account-brand"' in account_html, "account.html missing account-brand")
check('class="account-back-link"' in account_html, "account.html missing account-back-link")

print("=== 2. Checking CSS rules and properties ===")
shared_css = (BASE_DIR / 'shared.css').read_text(encoding='utf-8')
check('order: 1' in shared_css, "shared.css missing order: 1 for logo")
check('order: 2' in shared_css, "shared.css missing order: 2 for streak")
check('order: 3' in shared_css, "shared.css missing order: 3 for account")
check('order: 4' in shared_css, "shared.css missing order: 4 for settings")
check('order: 5' in shared_css, "shared.css missing order: 5 for navigation")
check('flex-wrap: wrap' in shared_css, "shared.css missing flex-wrap: wrap")
check('min-height: calc(96px + env(safe-area-inset-top, 0px))' in shared_css, "shared.css missing 96px navbar min-height")
check('top: calc(106px + env(safe-area-inset-top, 0px))' in shared_css, "shared.css missing 106px popover top offset")

# Check tap targets in CSS
account_css = (BASE_DIR / 'account.css').read_text(encoding='utf-8')
check(re.search(r'\.account-back-link[^{]*\{[^}]*min-height:\s*44px', account_css) is not None,
      "account.css .account-back-link missing min-height: 44px")

chat_css = (BASE_DIR / 'career/chat.css').read_text(encoding='utf-8')
check(re.search(r'\.btn-reset[^{]*\{[^}]*min-height:\s*44px', chat_css) is not None,
      "career/chat.css .btn-reset missing min-height: 44px")

# Check page clearances under @media (max-width: 480px)
pages_clearance = [
    ('style.css', r'\.main-content[^{]*\{[^}]*padding-top:\s*calc\(106px\s*\+\s*env\(safe-area-inset-top'),
    ('career/chat.css', r'\.main-career[^{]*\{[^}]*padding-top:\s*calc\(106px\s*\+\s*env\(safe-area-inset-top'),
    ('schedule/create.css', r'\.main-schedule[^{]*\{[^}]*padding-top:\s*calc\(106px\s*\+\s*env\(safe-area-inset-top'),
    ('todo/mylist.css', r'\.project-wrapper[^{]*\{[^}]*margin-top:\s*calc\(106px\s*\+\s*env\(safe-area-inset-top'),
    ('flashcard/flashcard.css', r'\.fc-main[^{]*\{[^}]*padding-top:\s*calc\(106px\s*\+\s*env\(safe-area-inset-top'),
]

for file_name, regex in pages_clearance:
    css = (BASE_DIR / file_name).read_text(encoding='utf-8')
    m_480 = re.search(r'@media\s*\(\s*max-width:\s*480px\s*\)\s*\{([^}]+(\{[^}]*\}[^}]*)*)\}', css)
    check(m_480 is not None, f"{file_name} missing @media (max-width: 480px)")
    if m_480:
        check(re.search(regex, m_480.group(0)) is not None,
              f"{file_name} missing 106px top clearance in @media (max-width: 480px)")

print("=== 3. Checking Media Query Cascade Order ===")
# Wider media queries must precede narrower ones
for file_name in ['shared.css', 'style.css', 'career/chat.css', 'schedule/create.css', 'todo/mylist.css', 'flashcard/flashcard.css']:
    css = (BASE_DIR / file_name).read_text(encoding='utf-8')
    idx_768 = css.find('max-width: 768px')
    idx_480 = css.find('max-width: 480px')
    if idx_768 != -1 and idx_480 != -1:
        check(idx_768 < idx_480, f"{file_name}: max-width: 768px must appear BEFORE max-width: 480px")

idx_480_shared = shared_css.find('max-width: 480px')
idx_330_shared = shared_css.find('max-width: 330px')
check(idx_480_shared < idx_330_shared, "shared.css: max-width: 480px must appear BEFORE max-width: 330px")

print("=== 4. Checking Mathematical Geometry & Tap Targets ===")
# Screen width tests
for W in [320, 360, 375, 390, 414, 480]:
    # Padding in nav-container:
    pad_h = 12 if W > 330 else 6
    avail_w = W - 2 * pad_h
    # Row 1 items:
    # logo font 19px (~80px at 375), 16px at 330 (~70px)
    logo_w = 70 if W <= 330 else 85
    streak_w = 42 if W <= 330 else 52
    streak_mr = 6
    acc_w = 38
    acc_mr = 6
    settings_w = 38
    row1_w = logo_w + streak_w + streak_mr + acc_w + acc_mr + settings_w
    check(row1_w <= avail_w, f"Width {W}px: Row 1 overflow! row1_w={row1_w} > avail_w={avail_w}")

    # Row 2 items:
    nav_pad_h = 4 if W > 330 else 2
    nav_inner_w = avail_w - 2 * nav_pad_h
    tab_w = nav_inner_w / 5
    check(tab_w >= 44.0, f"Width {W}px: Tab width {tab_w:.1f}px < 44px HIG minimum!")

print(f"\nVerification Results:")
print(f"Total Errors: {len(errors)}")
print(f"Total Warnings: {len(warnings)}")

if errors:
    print("\nERRORS FOUND:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
else:
    print("All checks PASSED successfully!")
    sys.exit(0)
