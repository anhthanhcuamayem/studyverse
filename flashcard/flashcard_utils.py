"""Studyverse Flashcard Utilities: parsing documents, extracting structured cards,
and heuristic & AI-assisted flashcard generation.
"""
import csv
import io
import json
import re
from typing import Any, Dict, List, Optional, Tuple

try:
    import pypdf
except ImportError:
    pypdf = None


# Giới hạn kích thước ký tự phân tích để tránh treo server
MAX_PARSE_TEXT_CHARS = 100_000


def clean_text_whitespace(text: str) -> str:
    """Chuẩn hóa ký tự khoảng trắng và xuống dòng."""
    if not text:
        return ''
    # Chuẩn hóa xuống dòng
    normalized = text.replace('\r\n', '\n').replace('\r', '\n')
    # Loại bỏ null bytes
    normalized = normalized.replace('\x00', '')
    return normalized.strip()


def extract_docx_text(file_bytes: bytes) -> str:
    """Trích xuất văn bản từ tệp Word (.docx) thuần bằng chuẩn OpenXML."""
    import xml.etree.ElementTree as ET
    import zipfile

    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as docx_zip:
            if 'word/document.xml' not in docx_zip.namelist():
                raise ValueError("Tệp .docx không đúng cấu trúc OpenXML hợp lệ.")
            xml_content = docx_zip.read('word/document.xml')
            tree = ET.fromstring(xml_content)

            ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
            paragraphs = []
            for p in tree.iter(f'{ns}p'):
                texts = [node.text for node in p.iter(f'{ns}t') if node.text]
                if texts:
                    paragraphs.append(''.join(texts))

            # Fallback nếu không có namespace chuẩn
            if not paragraphs:
                for p in tree.iter('p'):
                    texts = [node.text for node in p.iter('t') if node.text]
                    if texts:
                        paragraphs.append(''.join(texts))

            return clean_text_whitespace('\n'.join(paragraphs))
    except zipfile.BadZipFile:
        raise ValueError("Tệp không phải tệp .docx hợp lệ hoặc đã bị lỗi nén.")


def extract_pdf_text(file_bytes: bytes) -> str:
    """Trích xuất văn bản từ tệp PDF bằng pypdf kèm fallback regex."""
    text_content = ''
    if pypdf is not None:
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            pages = []
            for page in reader.pages:
                try:
                    t = page.extract_text()
                    if t:
                        pages.append(t)
                except Exception:
                    continue
            if pages:
                text_content = '\n\n'.join(pages)
        except Exception:
            text_content = ''

    if not text_content:
        # Fallback giải mã luồng văn bản cơ bản
        try:
            raw = file_bytes.decode('latin-1', errors='ignore')
            parts = []
            for match in re.finditer(r'\((.*?)\)\s*Tj|\[(.*?)\]\s*TJ', raw, flags=re.DOTALL):
                chunk = match.group(1) or match.group(2)
                if chunk:
                    clean = re.sub(r'\\([0-9]{3}|.)', r'\1', chunk)
                    parts.append(clean)
            if parts:
                text_content = ' '.join(parts)
        except Exception:
            pass

    return clean_text_whitespace(text_content)


def extract_json_cards(raw_text: str) -> Tuple[List[Dict[str, str]], str]:
    """Phát hiện và nạp danh sách flashcard từ nội dung JSON.
    Trả về (cards, readable_text).
    """
    try:
        data = json.loads(raw_text)
    except Exception as e:
        raise ValueError(f"Dữ liệu JSON không hợp lệ: {e}")

    cards: List[Dict[str, str]] = []
    items: List[Any] = []

    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        if isinstance(data.get('cards'), list):
            items = data['cards']
        elif isinstance(data.get('flashcards'), list):
            items = data['flashcards']
        else:
            # Dictionary key -> value (Thuật ngữ: Định nghĩa)
            for k, v in data.items():
                if isinstance(v, (str, int, float)) and str(k).strip() and str(v).strip():
                    cards.append({
                        'front': str(k).strip(),
                        'back': str(v).strip(),
                        'hint': ''
                    })
            readable = json.dumps(data, ensure_ascii=False, indent=2)
            return cards, readable

    for item in items:
        if isinstance(item, dict):
            front = (
                item.get('front')
                or item.get('question')
                or item.get('term')
                or item.get('q')
                or item.get('cau_hoi')
                or item.get('mat_truoc')
                or ''
            )
            back = (
                item.get('back')
                or item.get('answer')
                or item.get('definition')
                or item.get('a')
                or item.get('tra_loi')
                or item.get('mat_sau')
                or item.get('nghia')
                or ''
            )
            hint = item.get('hint') or item.get('goi_y') or item.get('note') or ''
            if str(front).strip() and str(back).strip():
                cards.append({
                    'front': str(front).strip(),
                    'back': str(back).strip(),
                    'hint': str(hint).strip() if hint else ''
                })

    readable = json.dumps(data, ensure_ascii=False, indent=2)
    return cards, readable


def extract_csv_cards(raw_text: str) -> Tuple[List[Dict[str, str]], str]:
    """Trích xuất flashcard từ định dạng CSV/TSV.
    Trả về (cards, readable_text).
    """
    lines = [l for l in raw_text.splitlines() if l.strip()]
    if not lines:
        return [], ''

    # Xác định delimiter
    first_line = lines[0]
    delimiter = ','
    if '\t' in first_line:
        delimiter = '\t'
    elif ';' in first_line and ',' not in first_line:
        delimiter = ';'

    try:
        reader = csv.reader(lines, delimiter=delimiter)
        rows = [r for r in reader if any(cell.strip() for cell in r)]
    except Exception as e:
        raise ValueError(f"Không thể đọc file CSV: {e}")

    if not rows:
        return [], raw_text

    cards: List[Dict[str, str]] = []
    header = [c.lower().strip() for c in rows[0]]

    # Nhận diện cột qua tên header
    f_alias = {'front', 'mặt trước', 'câu hỏi', 'cau hoi', 'question', 'term', 'thuật ngữ', 'tu vung', 'từ vựng', 'q'}
    b_alias = {'back', 'mặt sau', 'trả lời', 'tra loi', 'đáp án', 'dap an', 'answer', 'definition', 'định nghĩa', 'nghĩa', 'nghia', 'a', 'meaning'}
    h_alias = {'hint', 'gợi ý', 'goi y', 'note', 'ghi chú', 'ví dụ', 'example'}

    front_indices = [i for i, h in enumerate(header) if h in f_alias]
    back_indices = [i for i, h in enumerate(header) if h in b_alias]
    hint_indices = [i for i, h in enumerate(header) if h in h_alias]

    start_idx = 0
    if front_indices and back_indices:
        f_idx = front_indices[0]
        b_idx = back_indices[0]
        h_idx = hint_indices[0] if hint_indices else None
        start_idx = 1
    elif len(rows[0]) >= 2:
        # Nếu dòng 1 có >= 2 cột
        f_idx = 0
        b_idx = 1
        h_idx = 2 if len(rows[0]) >= 3 else None
        # Kiểm tra xem dòng 1 có phải header không
        if any(h in header[0] for h in ('front', 'term', 'question', 'câu hỏi', 'từ vựng')) or any(h in header[1] for h in ('back', 'answer', 'nghĩa', 'định nghĩa')):
            start_idx = 1
    else:
        f_idx, b_idx, h_idx = None, None, None

    if f_idx is not None and b_idx is not None:
        for r in rows[start_idx:]:
            if len(r) > max(f_idx, b_idx):
                f = r[f_idx].strip()
                b = r[b_idx].strip()
                h = r[h_idx].strip() if (h_idx is not None and len(r) > h_idx) else ''
                if f and b:
                    cards.append({'front': f, 'back': b, 'hint': h})

    return cards, clean_text_whitespace(raw_text)


def extract_file_content(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Đọc tệp tin tải lên (.txt, .md, .json, .csv, .pdf, .docx),
    trả về dictionary gồm text, cards sẵn có (nếu có), filename và định dạng.
    """
    if not filename:
        raise ValueError("Tên tệp tin không được để trống.")

    lower_name = filename.lower()
    ext = lower_name.rsplit('.', 1)[-1] if '.' in lower_name else ''

    cards: List[Dict[str, str]] = []
    text_content = ''

    if ext in ('txt', 'md', 'text'):
        # Thử giải mã utf-8, nếu lỗi thử utf-8-sig rồi latin-1
        try:
            text_content = file_bytes.decode('utf-8')
        except UnicodeDecodeError:
            try:
                text_content = file_bytes.decode('utf-8-sig')
            except UnicodeDecodeError:
                text_content = file_bytes.decode('latin-1', errors='replace')
        text_content = clean_text_whitespace(text_content)

    elif ext == 'json':
        try:
            raw_str = file_bytes.decode('utf-8')
        except UnicodeDecodeError:
            raw_str = file_bytes.decode('latin-1', errors='replace')
        cards, text_content = extract_json_cards(raw_str)

    elif ext in ('csv', 'tsv'):
        try:
            raw_str = file_bytes.decode('utf-8')
        except UnicodeDecodeError:
            raw_str = file_bytes.decode('latin-1', errors='replace')
        cards, text_content = extract_csv_cards(raw_str)

    elif ext == 'docx':
        text_content = extract_docx_text(file_bytes)

    elif ext == 'pdf':
        text_content = extract_pdf_text(file_bytes)

    else:
        # Định dạng chưa hỗ trợ trực tiếp -> thử đọc dạng text
        try:
            text_content = clean_text_whitespace(file_bytes.decode('utf-8'))
        except Exception:
            raise ValueError(f"Định dạng tệp .{ext} không được hỗ trợ. Hãy dùng .txt, .pdf, .docx, .csv, .json hoặc .md.")

    # Cắt gọn độ dài văn bản nếu vượt ngưỡng bảo vệ
    if len(text_content) > MAX_PARSE_TEXT_CHARS:
        text_content = text_content[:MAX_PARSE_TEXT_CHARS]

    return {
        'filename': filename,
        'extension': ext,
        'text': text_content,
        'cards': cards,
        'char_count': len(text_content),
        'has_prestructured_cards': len(cards) > 0
    }


def clean_card_component(text: str) -> str:
    """Loại bỏ ký tự gạch đầu dòng, số thứ tự ở đầu."""
    s = text.strip()
    s = re.sub(r'^[-\*•\d\.\)\s]+\s*', '', s)
    return s.strip()


def generate_flashcards_heuristic(text: str, num_cards: int = 10, title: Optional[str] = None) -> List[Dict[str, str]]:
    """Phân tích văn bản thông minh theo thuật toán quy tắc (heuristic),
    nhận diện cặp khái niệm - giải thích, câu hỏi - trả lời và câu trọng tâm.
    Hoạt động 100% offline, không cần gọi AI API.
    """
    text = clean_text_whitespace(text)
    if not text:
        return []

    num_cards = max(1, min(int(num_cards), 50))
    cards: List[Dict[str, str]] = []
    seen_fronts = set()

    def add_card(front: str, back: str, hint: str = '') -> bool:
        f = clean_card_component(front)
        b = back.strip()
        h = hint.strip()
        if not f or not b or len(f) < 2 or len(b) < 2:
            return False
        # Tránh câu quá dài làm mặt trước flashcard
        if len(f) > 160:
            return False
        f_norm = f.lower()
        if f_norm in seen_fronts:
            return False
        seen_fronts.add(f_norm)
        cards.append({'front': f, 'back': b, 'hint': h})
        return True

    lines = [l.strip() for l in text.splitlines() if l.strip()]

    # 1. Tìm mẫu Câu hỏi / Trả lời (Q&A)
    # Ví dụ: "Q: ... \n A: ..." hoặc "Hỏi: ... Đáp: ..."
    i = 0
    while i < len(lines):
        line = lines[i]
        qa_match = re.match(r'^(?:hỏi|câu\s*hỏi|q|question)\s*[\d\.\:]*\s*(.+)$', line, re.IGNORECASE)
        if qa_match:
            q_text = qa_match.group(1).strip()
            # Tìm câu trả lời ở dòng kế tiếp
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                ans_match = re.match(r'^(?:đáp|trả\s*lời|a|answer)\s*[\d\.\:]*\s*(.+)$', next_line, re.IGNORECASE)
                if ans_match:
                    add_card(q_text, ans_match.group(1).strip())
                    i += 2
                    continue
        # Dòng kết thúc bằng dấu '?' và dòng sau là đáp án
        if line.endswith('?') and 5 <= len(line) <= 120 and (i + 1 < len(lines)):
            next_line = lines[i + 1]
            if not next_line.endswith('?') and len(next_line) >= 4:
                add_card(line, next_line)
                i += 2
                continue
        i += 1

    # 2. Tìm mẫu Phân cách (Thuật ngữ: Định nghĩa, Concept - Definition, Term = Meaning)
    # Dấu phân cách: ':', '-', '–', '—', '='
    delim_pattern = re.compile(
        r'^(?:[-*•\d\.\)]\s*)*(?P<front>[^:\-–—=><\n\t]{2,80})\s*[:\-–—=]\s*(?P<back>.+)$'
    )
    for line in lines:
        if len(cards) >= num_cards * 2:
            break
        m = delim_pattern.match(line)
        if m:
            front = m.group('front').strip()
            back = m.group('back').strip()
            # Bỏ qua nếu front chỉ là URL hoặc số thời gian (07:00)
            if re.match(r'^\d{1,2}:\d{2}', front) or front.startswith('http'):
                continue
            add_card(front, back)

    # 3. Tìm mẫu định nghĩa bằng từ khóa tiếng Việt / tiếng Anh trong câu
    # Ví dụ: "RAM là bộ nhớ truy xuất ngẫu nhiên", "Photosynthesis is the process..."
    def_kw_pattern = re.compile(
        r'(?P<front>[A-ZÀ-Ỹa-zà-ỹ0-9\s]{2,60})\s+(?:được định nghĩa là|là|nghĩa là|chính là|is defined as|refers to|means|is an?)\s+(?P<back>[^.;]{10,250})',
        re.IGNORECASE
    )
    for line in lines:
        if len(cards) >= num_cards * 2:
            break
        for match in def_kw_pattern.finditer(line):
            front = match.group('front').strip()
            back = match.group('back').strip()
            # Đảm bảo front là thuật ngữ gọn gàng
            if 2 <= len(front.split()) <= 6:
                add_card(f"{front} là gì?", back)

    # 4. Nếu vẫn chưa đủ số lượng thẻ, phân tích các câu và đoạn văn có ý nghĩa
    if len(cards) < num_cards:
        # Gom các câu từ các đoạn
        sentences = re.split(r'(?<=[.!?])\s+', text)
        for s in sentences:
            s = s.strip()
            if 30 <= len(s) <= 220:
                # Tìm vế đầu làm câu hỏi
                parts = re.split(r'[,;:]', s, maxsplit=1)
                if len(parts) == 2 and len(parts[0].strip()) >= 10 and len(parts[1].strip()) >= 15:
                    front = f"Nội dung trọng tâm: {parts[0].strip()}?"
                    back = parts[1].strip()
                    add_card(front, back)
                else:
                    # Tạo câu hỏi ôn tập tổng quát
                    words = s.split()
                    if len(words) >= 6:
                        key_term = ' '.join(words[:4])
                        add_card(f"Điểm cần nhớ về: \"{key_term}...\"", s)
            if len(cards) >= num_cards:
                break

    # 5. Nếu văn bản cực ngắn hoặc không có cấu trúc trên, tạo tối thiểu 1 thẻ tóm tắt
    if not cards and len(text) >= 5:
        first_line = lines[0] if lines else "Tài liệu học tập"
        content_summary = text[:200] + ('...' if len(text) > 200 else '')
        cards.append({
            'front': f"Tóm tắt: {first_line[:50]}",
            'back': content_summary,
            'hint': 'Nội dung trích xuất từ tài liệu'
        })

    return cards[:num_cards]


def build_ai_prompt(text: str, num_cards: int = 10, style: str = 'concept') -> List[Dict[str, str]]:
    """Tạo messages gọi AI để phân tích và tạo flashcard tối ưu."""
    num_cards = max(1, min(int(num_cards), 30))

    style_instruction = {
        'concept': "Trích xuất thuật ngữ cốt lõi, công thức hoặc khái niệm then chốt làm mặt trước; định nghĩa/giải thích súc tích làm mặt sau.",
        'qa': "Tạo câu hỏi trọng tâm (Hỏi gì? Tại sao? Làm thế nào?) làm mặt trước; câu trả lời chính xác, dễ hiểu làm mặt sau.",
        'quiz': "Mặt trước là câu hỏi kèm 4 lựa chọn (A, B, C, D); mặt sau là đáp án đúng kèm lời giải thích ngắn gọn."
    }.get(style, "Trích xuất các ý chính, định nghĩa và câu hỏi quan trọng.")

    system_content = (
        "Bạn là Chuyên gia Học tập & Flashcard của Studyverse. "
        "Nhiệm vụ của bạn là phân tích tài liệu được cung cấp và tạo ra các flashcard ghi nhớ chất lượng cao, "
        "giúp học sinh, sinh viên ôn tập nhanh chóng theo phương pháp lặp lại ngắt quãng (Spaced Repetition).\n\n"
        f"Yêu cầu:\n"
        f"1. Tạo ĐÚNG {num_cards} flashcard cô đọng, giá trị cao.\n"
        f"2. Phong cách: {style_instruction}\n"
        "3. Trả về DUY NHẤT một mảng JSON các đối tượng theo định dạng:\n"
        "[\n"
        "  {\n"
        "    \"front\": \"Nội dung mặt trước (câu hỏi / thuật ngữ ngắn gọn)\",\n"
        "    \"back\": \"Nội dung mặt sau (câu trả lời / định nghĩa chuẩn xác)\",\n"
        "    \"hint\": \"Gợi ý ngắn (nếu có, hoặc để trống)\"\n"
        "  }\n"
        "]\n"
        "KHÔNG thêm bất kỳ văn bản giải thích nào ngoài mảng JSON hợp lệ."
    )

    user_content = f"Tài liệu học tập cần tạo {num_cards} flashcard:\n\n{text[:12000]}"

    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content}
    ]


def parse_ai_cards_response(reply_text: str) -> Optional[List[Dict[str, str]]]:
    """Phân tích phản hồi từ AI thành danh sách flashcard hợp lệ."""
    if not reply_text or not isinstance(reply_text, str):
        return None

    cleaned = reply_text.strip()
    # Loại bỏ code block markdown ```json ... ```
    cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r'\s*```$', '', cleaned, flags=re.MULTILINE)
    cleaned = cleaned.strip()

    # Tìm mảng JSON [ ... ]
    start = cleaned.find('[')
    end = cleaned.rfind(']')
    if start != -1 and end != -1 and end > start:
        cleaned = cleaned[start:end + 1]

    try:
        data = json.loads(cleaned)
    except Exception:
        return None

    if not isinstance(data, list):
        return None

    cards: List[Dict[str, str]] = []
    for item in data:
        if isinstance(item, dict):
            f = str(item.get('front') or item.get('question') or '').strip()
            b = str(item.get('back') or item.get('answer') or '').strip()
            h = str(item.get('hint') or '').strip()
            if f and b:
                cards.append({'front': f, 'back': b, 'hint': h})

    return cards if cards else None
