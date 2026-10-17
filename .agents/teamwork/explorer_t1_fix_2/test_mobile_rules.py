import re
import pathlib

def extract_media_blocks(css: str, max_width_limit: int = 768):
    """Finds all @media blocks with max-width <= max_width_limit and returns their contents."""
    blocks = []
    # Match @media with max-width: <number>px
    pattern = re.compile(r"@media[^{]*max-width:\s*(\d+)px[^{]*\{", re.IGNORECASE)
    for m in pattern.finditer(css):
        width = int(m.group(1))
        if width <= max_width_limit:
            start = m.end()
            depth = 1
            i = start
            while i < len(css) and depth > 0:
                if css[i] == '{':
                    depth += 1
                elif css[i] == '}':
                    depth -= 1
                i += 1
            blocks.append((width, css[start:i-1]))
    # Sort blocks by width descending so larger mobile queries come first, smaller override later
    blocks.sort(key=lambda x: x[0], reverse=True)
    return [b[1] for b in blocks]

def get_rule_declaration(css_block: str, selector_pattern: str, prop: str = "font-size") -> str | None:
    """Finds rule matching selector_pattern in css_block and returns declaration value."""
    # Find selector block: selector [^{]* { body }
    # To avoid crossing into next rule, we can search for selector followed by { ... }
    # Note: css_block might have multiple rules. We search for selector_pattern followed by {
    m = re.search(rf"(?:^|[,\}}\s])({selector_pattern})[^{{]*\{{([^}}]+)\}}", css_block)
    if not m:
        return None
    body = m.group(2)
    decl = re.search(rf"\b{prop}\s*:\s*([^;!]+)", body, re.IGNORECASE)
    if not decl:
        return None
    return decl.group(1).strip()

def is_font_size_ge_16(val: str | None) -> bool:
    if not val:
        return False
    val = val.strip().lower()
    if val.endswith('px'):
        try:
            return float(val[:-2].strip()) >= 16.0
        except ValueError:
            return False
    if val.endswith('rem') or val.endswith('em'):
        unit = 3 if val.endswith('rem') else 2
        try:
            return float(val[:-unit].strip()) >= 1.0
        except ValueError:
            return False
    return False

def get_effective_mobile_font_size(css: str, selector_pattern: str, max_width_limit: int = 768) -> str | None:
    """Returns effective font-size on mobile: mobile media query override if present, else base rule."""
    media_blocks = extract_media_blocks(css, max_width_limit)
    for block in media_blocks:
        val = get_rule_declaration(block, selector_pattern, "font-size")
        if val is not None:
            return val
    # Fallback to base rule
    return get_rule_declaration(css, selector_pattern, "font-size")

# Let us run test against all target form selectors:
targets = [
    ("shared.css", r"\.sv-modal-input", "shared modal input"),
    ("shared.css", r"(?:input|select|textarea)", "shared mobile form base"),
    ("account.css", r"\.account-input-wrap\s+input", "account inputs"),
    ("account.css", r"\.account-select-wrap\s+select", "account selects"),
    ("schedule/create.css", r"\.tc-input", "schedule tc-input"),
    ("schedule/create.css", r"input\[type=[\"']?text[\"']?\]", "schedule text inputs"),
    ("todo/mylist.css", r"\.todo-search-wrap\s+input", "todo search input"),
    ("todo/mylist.css", r"#taskNameInput", "todo taskNameInput"),
    ("todo/mylist.css", r"\.todo-filter-row\s+select", "todo filter select"),
    ("todo/mylist.css", r"\.task-meta-grid\s+select", "todo task meta select"),
    ("flashcard/flashcard.css", r"\.fc-select", "flashcard fc-select"),
    ("flashcard/flashcard.css", r"\.fc-input", "flashcard fc-input"),
    ("flashcard/flashcard.css", r"\.fc-textarea", "flashcard fc-textarea"),
    ("flashcard/flashcard.css", r"\.fc-preview-input", "flashcard fc-preview-input"),
    ("career/chat.css", r"\.chat-input-area\s+textarea", "chat textarea"),
]

print("=== EFFECTIVE MOBILE FONT SIZES ON CURRENT REPO ===")
for fname, sel, desc in targets:
    css = pathlib.Path(fname).read_text(encoding="utf-8")
    eff = get_effective_mobile_font_size(css, sel)
    ge_16 = is_font_size_ge_16(eff)
    print(f"{desc:<28} | {fname:<25} | eff: {str(eff):<10} | ge_16: {ge_16}")
