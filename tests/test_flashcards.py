"""Tests for Studyverse Flashcard module: document parsing, heuristic extraction,
AI generation with automatic fallback, API endpoints, and navbar integrity across pages.
"""
import io
import json
import zipfile
import pytest

import app as app_module
from app import PUBLIC_FILES, app as flask_app
from flashcard.flashcard_utils import (
    extract_file_content,
    extract_docx_text,
    extract_pdf_text,
    extract_json_cards,
    extract_csv_cards,
    generate_flashcards_heuristic,
    build_ai_prompt,
    parse_ai_cards_response,
)


@pytest.fixture
def client():
    flask_app.config.update(TESTING=True)
    with flask_app.test_client() as test_client:
        yield test_client


# ==================== TEST FLASHCARD UTILITIES ====================
def test_extract_txt_and_md():
    content = "Thuật ngữ 1: Định nghĩa 1\nThuật ngữ 2: Định nghĩa 2"
    res_txt = extract_file_content(content.encode('utf-8'), 'notes.txt')
    assert res_txt['text'] == content
    assert res_txt['extension'] == 'txt'

    res_md = extract_file_content(content.encode('utf-8'), 'readme.md')
    assert res_md['text'] == content
    assert res_md['extension'] == 'md'


def test_extract_json_prestructured_cards():
    deck_json = json.dumps([
        {"front": "RAM", "back": "Random Access Memory", "hint": "Memory"},
        {"front": "CPU", "back": "Central Processing Unit", "hint": "Processor"}
    ])
    res = extract_file_content(deck_json.encode('utf-8'), 'cards.json')
    assert res['has_prestructured_cards'] is True
    assert len(res['cards']) == 2
    assert res['cards'][0]['front'] == 'RAM'
    assert res['cards'][0]['back'] == 'Random Access Memory'


def test_extract_json_dict_format():
    deck_json = json.dumps({
        "title": "Computer Science",
        "cards": [
            {"term": "HTML", "definition": "HyperText Markup Language"},
            {"q": "CSS", "a": "Cascading Style Sheets"}
        ]
    })
    cards, readable = extract_json_cards(deck_json)
    assert len(cards) == 2
    assert cards[0]['front'] == 'HTML'
    assert cards[1]['front'] == 'CSS'


def test_extract_csv_with_headers():
    csv_content = "front,back,hint\nThủ đô Việt Nam,Hà Nội,Miền Bắc\nThủ đô Pháp,Paris,Châu Âu"
    cards, readable = extract_csv_cards(csv_content)
    assert len(cards) == 2
    assert cards[0]['front'] == 'Thủ đô Việt Nam'
    assert cards[0]['back'] == 'Hà Nội'
    assert cards[0]['hint'] == 'Miền Bắc'


def test_extract_csv_without_headers():
    tsv_content = "Python\tNgôn ngữ lập trình thông dịch\nJavaScript\tNgôn ngữ cho trình duyệt web"
    cards, _ = extract_csv_cards(tsv_content)
    assert len(cards) == 2
    assert cards[0]['front'] == 'Python'
    assert cards[1]['front'] == 'JavaScript'


def test_extract_docx_real_zip():
    # Tạo in-memory docx hợp lệ
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, 'w') as zf:
        xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:body>
                <w:p><w:r><w:t>Đoạn văn 1: Giới thiệu Studyverse Flashcard</w:t></w:r></w:p>
                <w:p><w:r><w:t>Đoạn văn 2: Học ngắt quãng giúp nhớ lâu</w:t></w:r></w:p>
            </w:body>
        </w:document>'''
        zf.writestr('word/document.xml', xml)
    
    extracted = extract_docx_text(bio.getvalue())
    assert "Đoạn văn 1: Giới thiệu Studyverse Flashcard" in extracted
    assert "Đoạn văn 2: Học ngắt quãng giúp nhớ lâu" in extracted


def test_extract_docx_invalid_raises():
    with pytest.raises(ValueError):
        extract_docx_text(b'not a zip file')


def test_heuristic_flashcard_generation():
    doc = """
    Chương 1: Khoa học máy tính
    RAM: Bộ nhớ truy xuất ngẫu nhiên trên máy tính
    ROM: Bộ nhớ chỉ đọc
    CPU - Bộ vi xử lý trung tâm điều khiển máy tính
    Quang hợp là gì?: Quá trình tổng hợp chất hữu cơ nhờ ánh sáng
    Hỏi: Ai là người phát minh ra bóng đèn?
    Đáp: Thomas Edison
    Khái niệm Blockchain được định nghĩa là sổ cái phân tán bảo mật cao
    """
    cards = generate_flashcards_heuristic(doc, num_cards=6)
    assert len(cards) >= 4
    fronts = [c['front'] for c in cards]
    assert any('RAM' in f for f in fronts)
    assert any('CPU' in f for f in fronts)
    assert any('Thomas Edison' in c['back'] for c in cards)


def test_heuristic_fallback_short_text():
    short = "Học tập mỗi ngày giúp tiến bộ nhanh chóng."
    cards = generate_flashcards_heuristic(short, num_cards=3)
    assert len(cards) >= 1
    assert cards[0]['front']
    assert cards[0]['back']


def test_ai_prompt_building_and_parsing():
    text = "Machine Learning là tập hợp các thuật toán học từ dữ liệu."
    messages = build_ai_prompt(text, num_cards=3, style='concept')
    assert len(messages) == 2
    assert messages[0]['role'] == 'system'
    assert 'Machine Learning' in messages[1]['content']

    # AI response dạng JSON thuần
    raw_ai = json.dumps([
        {"front": "Machine Learning", "back": "Thuật toán học từ dữ liệu", "hint": "AI"}
    ])
    cards = parse_ai_cards_response(raw_ai)
    assert len(cards) == 1
    assert cards[0]['front'] == 'Machine Learning'

    # AI response bọc trong markdown ```json ... ```
    raw_ai_md = "```json\n" + raw_ai + "\n```"
    cards_md = parse_ai_cards_response(raw_ai_md)
    assert len(cards_md) == 1
    assert cards_md[0]['front'] == 'Machine Learning'

    # Phản hồi lỗi
    assert parse_ai_cards_response("Đây không phải JSON") is None
    assert parse_ai_cards_response("") is None


# ==================== TEST API ENDPOINTS ====================
def test_parse_file_multipart_txt(client):
    file_bytes = b"Term A: Def A\nTerm B: Def B"
    data = {
        'file': (io.BytesIO(file_bytes), 'study.txt')
    }
    resp = client.post('/api/flashcards/parse-file', data=data, content_type='multipart/form-data')
    assert resp.status_code == 200
    res = resp.get_json()
    assert res['ok'] is True
    assert res['filename'] == 'study.txt'
    assert 'Term A: Def A' in res['text']


def test_parse_file_multipart_csv_prestructured(client):
    csv_bytes = b"front,back\nPython,Language\nFlask,Framework"
    data = {
        'file': (io.BytesIO(csv_bytes), 'cards.csv')
    }
    resp = client.post('/api/flashcards/parse-file', data=data, content_type='multipart/form-data')
    assert resp.status_code == 200
    res = resp.get_json()
    assert res['ok'] is True
    assert res['has_prestructured_cards'] is True
    assert len(res['cards']) == 2
    assert res['cards'][0]['front'] == 'Python'


def test_parse_file_json_body(client):
    payload = {
        'filename': 'pasted.txt',
        'text': 'Lập trình viên: Người viết mã phần mềm'
    }
    resp = client.post('/api/flashcards/parse-file', json=payload)
    assert resp.status_code == 200
    res = resp.get_json()
    assert res['ok'] is True
    assert 'Lập trình viên' in res['text']


def test_parse_file_empty_fails(client):
    data = {'file': (io.BytesIO(b''), 'empty.txt')}
    resp = client.post('/api/flashcards/parse-file', data=data, content_type='multipart/form-data')
    assert resp.status_code == 400


def test_generate_heuristic_mode(client):
    payload = {
        'text': "Toán rời rạc: Môn học về cấu trúc rời rạc.\nĐồ thị: Tập hợp đỉnh và cạnh.",
        'num_cards': 5,
        'mode': 'heuristic'
    }
    resp = client.post('/api/flashcards/generate', json=payload)
    assert resp.status_code == 200
    res = resp.get_json()
    assert res['ok'] is True
    assert res['source'] == 'heuristic'
    assert len(res['cards']) >= 2


def test_generate_ai_mode_success_mocked(client, monkeypatch):
    mock_cards = [{"front": "Khái niệm 1", "back": "Định nghĩa 1", "hint": "Gợi ý"}]
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['freellmapi'])
    monkeypatch.setattr(app_module, 'request_ai', lambda messages, max_tokens, provider=None: (json.dumps(mock_cards), None))

    payload = {
        'text': "Tài liệu học tập chi tiết...",
        'num_cards': 3,
        'mode': 'ai'
    }
    resp = client.post('/api/flashcards/generate', json=payload)
    assert resp.status_code == 200
    res = resp.get_json()
    assert res['ok'] is True
    assert res['source'] == 'ai'
    assert len(res['cards']) == 1
    assert res['cards'][0]['front'] == 'Khái niệm 1'


def test_generate_ai_mode_automatic_fallback(client, monkeypatch):
    # Khi AI bị lỗi, hệ thống phải tự động fallback sang heuristic
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['freellmapi'])
    monkeypatch.setattr(app_module, 'request_ai', lambda messages, max_tokens, provider=None: (None, ({'error': 'API offline'}, 502)))

    payload = {
        'text': "Hệ điều hành: Phần mềm quản lý tài nguyên phần cứng.\nTrình biên dịch: Dịch mã nguồn sang mã máy.",
        'num_cards': 2,
        'mode': 'ai'
    }
    resp = client.post('/api/flashcards/generate', json=payload)
    assert resp.status_code == 200
    res = resp.get_json()
    assert res['ok'] is True
    assert res['source'] == 'heuristic'
    assert res.get('fallback') is True
    assert len(res['cards']) >= 1


def test_generate_validation_empty_text(client):
    resp = client.post('/api/flashcards/generate', json={'text': '   '})
    assert resp.status_code == 400


# ==================== TEST NAVBAR INTEGRATION TRÊN TOÀN BỘ CÁC TRANG ====================
PAGES_TO_CHECK = [
    'index.html',
    'todo/mylist.html',
    'schedule/create.html',
    'career/chat.html',
    'flashcard/flashcard.html',
]


@pytest.mark.parametrize('page', PAGES_TO_CHECK)
def test_navbar_contains_flashcard_tab_on_all_pages(client, page):
    resp = client.get('/' + page)
    assert resp.status_code == 200, f"Trang {page} phải tải thành công"
    html = resp.data.decode('utf-8')

    # Thanh navigation phải hiện diện
    assert 'class="navigation"' in html

    # Tab flashcard phải có mặt trên thanh navbar với link chính xác
    assert '/flashcard/flashcard.html' in html
    assert 'data-i18n="nav.flashcard"' in html
    assert 'fa-layer-group' in html


def test_config_and_shared_contain_flashcard_keys():
    from pathlib import Path
    base_dir = Path(__file__).resolve().parent.parent

    config_js = (base_dir / 'config.js').read_text(encoding='utf-8')
    assert 'flashcards' in config_js

    shared_js = (base_dir / 'shared.js').read_text(encoding='utf-8')
    assert 'nav.flashcard' in shared_js
    assert 'studyverse_flashcards' in shared_js
