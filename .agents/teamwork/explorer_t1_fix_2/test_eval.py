import re
import pathlib

def extract_media_block(css, query_pattern):
    m = re.search(r"@media[^{]*" + query_pattern + r"[^{]*\{", css)
    if not m:
        return None
    start = m.end()
    depth = 1
    i = start
    while i < len(css) and depth > 0:
        if css[i] == "{":
            depth += 1
        elif css[i] == "}":
            depth -= 1
        i += 1
    return css[start:i-1]

def extract_rule_declaration(css_block, selector_pattern, prop="font-size"):
    if not css_block:
        return None
    m = re.search(selector_pattern + r"[^{]*\{([^}]+)\}", css_block)
    if not m:
        return None
    body = m.group(1)
    decl = re.search(rf"\b{prop}\s*:\s*([^;!]+)", body)
    if not decl:
        return None
    return decl.group(1).strip()

def is_font_size_ge_16px(val_str):
    if not val_str:
        return False
    val_str = val_str.strip()
    if val_str.endswith("px"):
        try:
            return float(val_str[:-2].strip()) >= 16.0
        except ValueError:
            return False
    if val_str.endswith("rem") or val_str.endswith("em"):
        try:
            return float(val_str[:-3 if val_str.endswith("rem") else -2].strip()) >= 1.0
        except ValueError:
            return False
    return False

tests = [
    ("shared.css", None, r"\.sv-modal-input"),
    ("shared.css", r"max-width:\s*768px", r"\.sv-modal-input"),
    ("account.css", None, r"\.account-input-wrap\s+input"),
    ("account.css", r"max-width:\s*(?:720|768)px", r"\.account-input-wrap\s+input"),
    ("account.css", None, r"\.account-select-wrap\s+select"),
    ("account.css", r"max-width:\s*(?:720|768)px", r"\.account-select-wrap\s+select"),
    ("flashcard/flashcard.css", None, r"\.fc-select"),
    ("flashcard/flashcard.css", r"max-width:\s*768px", r"\.fc-select"),
    ("flashcard/flashcard.css", None, r"\.fc-preview-input"),
    ("schedule/create.css", None, r"\.tc-input"),
    ("schedule/create.css", r"max-width:\s*(?:768|640)px", r"\.tc-input"),
    ("todo/mylist.css", None, r"\.todo-search-wrap\s+input"),
    ("todo/mylist.css", r"max-width:\s*768px", r"\.todo-search-wrap\s+input"),
    ("todo/mylist.css", r"max-width:\s*768px", r"#taskNameInput"),
    ("career/chat.css", r"max-width:\s*768px", r"\.chat-input-area\s+textarea"),
]

print(f"{'FILE':<24} | {'MEDIA QUERY':<28} | {'SELECTOR':<32} | {'VALUE':<10} | PASS?")
print("-" * 110)
for fname, mq, sel in tests:
    css = pathlib.Path(fname).read_text(encoding="utf-8")
    block = extract_media_block(css, mq) if mq else css
    val = extract_rule_declaration(block, sel)
    ok = is_font_size_ge_16px(val)
    mq_str = mq if mq else "(base stylesheet)"
    print(f"{fname:<24} | {mq_str:<28} | {sel:<32} | {str(val):<10} | {ok}")
