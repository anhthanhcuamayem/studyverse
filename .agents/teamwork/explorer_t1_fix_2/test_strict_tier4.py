import re
import pathlib
import pytest

BASE_DIR = pathlib.Path(".")

def _extract_media_blocks(css: str, max_width_limit: int = 768):
    blocks = []
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
    blocks.sort(key=lambda x: x[0], reverse=True)
    return [b[1] for b in blocks]

def _get_rule_declaration(css_block: str, selector_pattern: str, prop: str = "font-size") -> str | None:
    m = re.search(rf"(?:^|[,\}}\s])({selector_pattern})[^{{]*\{{([^}}]+)\}}", css_block)
    if not m:
        return None
    body = m.group(2)
    decl = re.search(rf"\b{prop}\s*:\s*([^;!]+)", body, re.IGNORECASE)
    if not decl:
        return None
    return decl.group(1).strip()

def _is_font_size_ge_16(val: str | None) -> bool:
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

def _get_effective_mobile_font_size(css: str, selector_pattern: str, max_width_limit: int = 768) -> str | None:
    media_blocks = _extract_media_blocks(css, max_width_limit)
    for block in media_blocks:
        val = _get_rule_declaration(block, selector_pattern, "font-size")
        if val is not None:
            return val
    return _get_rule_declaration(css, selector_pattern, "font-size")

# Run each test function and record result
results = {}

def run_test(name, func):
    try:
        func()
        results[name] = ("PASS", "Expected if code is compliant")
    except AssertionError as e:
        results[name] = ("FAIL (RED)", str(e))
    except Exception as e:
        results[name] = ("ERROR", str(e))

def t1():
    css = (BASE_DIR / 'shared.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'\.sv-modal-input')
    assert eff is not None, "shared.css must declare font-size for .sv-modal-input"
    assert _is_font_size_ge_16(eff), f".sv-modal-input font-size must be >= 16px on mobile, got '{eff}'"

def t2():
    css = (BASE_DIR / 'shared.css').read_text(encoding='utf-8')
    media_blocks = _extract_media_blocks(css, max_width_limit=768)
    found_rule = False
    for block in media_blocks:
        m = re.search(r'(?:^|[,\}\s])((?:input|select|textarea)[^{]*)\{([^}]+)\}', block, re.IGNORECASE)
        if m:
            body = m.group(2)
            decl = re.search(r'\bfont-size\s*:\s*([^;!]+)', body, re.IGNORECASE)
            if decl and _is_font_size_ge_16(decl.group(1).strip()):
                found_rule = True
                break
    assert found_rule, "shared.css must define mobile input/select/textarea >= 16px rule"

def t3():
    css = (BASE_DIR / 'account.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'\.account-input-wrap\s+input', max_width_limit=768)
    assert eff is not None, "account.css must declare font-size for .account-input-wrap input"
    assert _is_font_size_ge_16(eff), f"account inputs must be >= 16px on mobile, got '{eff}'"

def t4():
    css = (BASE_DIR / 'account.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'\.account-select-wrap\s+select', max_width_limit=768)
    assert eff is not None, "account.css must declare font-size for .account-select-wrap select"
    assert _is_font_size_ge_16(eff), f"account selects must be >= 16px on mobile, got '{eff}'"

def t5():
    css = (BASE_DIR / 'schedule/create.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'\.tc-input', max_width_limit=768)
    assert eff is not None, "schedule/create.css must declare font-size for .tc-input"
    assert _is_font_size_ge_16(eff), f".tc-input must be >= 16px on mobile, got '{eff}'"

def t6():
    css = (BASE_DIR / 'schedule/create.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'input\[type=[\'"]?(?:text|number)[\'"]?\]', max_width_limit=768)
    assert eff is not None, "schedule/create.css must define mobile font-size for text/number inputs"
    assert _is_font_size_ge_16(eff), f"schedule text/number inputs must be >= 16px on mobile, got '{eff}'"

def t7():
    css = (BASE_DIR / 'todo/mylist.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'\.todo-search-wrap\s+input', max_width_limit=768)
    assert eff is not None, "todo/mylist.css must declare font-size for .todo-search-wrap input"
    assert _is_font_size_ge_16(eff), f"todo search input must be >= 16px on mobile, got '{eff}'"

def t8():
    css = (BASE_DIR / 'todo/mylist.css').read_text(encoding='utf-8')
    eff_task = _get_effective_mobile_font_size(css, r'#taskNameInput', max_width_limit=768)
    eff_filter = _get_effective_mobile_font_size(css, r'\.todo-filter-row\s+select', max_width_limit=768)
    assert eff_task is not None and _is_font_size_ge_16(eff_task), f"#taskNameInput must be >= 16px, got '{eff_task}'"
    assert eff_filter is not None and _is_font_size_ge_16(eff_filter), f"filter selects must be >= 16px, got '{eff_filter}'"

def t9():
    css = (BASE_DIR / 'flashcard/flashcard.css').read_text(encoding='utf-8')
    eff_sel = _get_effective_mobile_font_size(css, r'\.fc-select', max_width_limit=768)
    assert eff_sel is not None and _is_font_size_ge_16(eff_sel), f".fc-select must be >= 16px, got '{eff_sel}'"

def t10():
    js = (BASE_DIR / 'todo/mylist.js').read_text(encoding='utf-8')
    js_matches = re.findall(
        r'<(?:input|select|textarea)[^>]*style=["\'][^"\']*font-size:\s*(\d+(?:\.\d+)?(?:px|rem|em))[^"\']*["\']',
        js, re.IGNORECASE
    )
    js_violating = [m for m in js_matches if not _is_font_size_ge_16(m)]
    assert len(js_violating) == 0, f"todo/mylist.js has inline font-size < 16px: {js_violating}"

def t11():
    css = (BASE_DIR / 'career/chat.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'\.chat-input-area\s+textarea', max_width_limit=768)
    assert eff is not None, "career/chat.css must define mobile font-size for .chat-input-area textarea"
    assert _is_font_size_ge_16(eff), f".chat-input-area textarea must maintain font-size >= 16px, got '{eff}'"

tests_to_run = [
    ("test_tier4_input_font_size_shared_modal", t1),
    ("test_tier4_input_font_size_shared_mobile_base", t2),
    ("test_tier4_input_font_size_account_inputs", t3),
    ("test_tier4_input_font_size_account_selects", t4),
    ("test_tier4_input_font_size_schedule_tc_input", t5),
    ("test_tier4_input_font_size_schedule_modal_inputs", t6),
    ("test_tier4_input_font_size_todo_search_input", t7),
    ("test_tier4_input_font_size_todo_task_inputs", t8),
    ("test_tier4_input_font_size_flashcard_controls", t9),
    ("test_tier4_no_sub16px_inline_font_sizes_in_mylist_js", t10),
    ("test_tier4_career_chat_textarea_maintains_16px", t11),
]

for name, fn in tests_to_run:
    run_test(name, fn)

print("\n=== RUN OF HARDENED TIER 4 TEST ASSERTIONS ===")
for name, (status, detail) in results.items():
    print(f"[{status}] {name}")
    if "FAIL" in status:
        print(f"    Reason: {detail}")
