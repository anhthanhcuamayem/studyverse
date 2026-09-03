def parse_time(time_str):
    h, m = map(int, time_str.split(':'))
    return h * 60 + m

def format_time(minutes):
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"

def generate_slots(available_slots, fixed_breaks, lesson_duration=45):
    """Tạo ra danh sách các khung giờ (slot) hợp lệ không trùng với giờ nghỉ."""
    slots = []
    default_breaks = [
        {"start": "22:00", "end": "06:00"},
        {"start": "06:30", "end": "07:00"},
        {"start": "11:30", "end": "12:30"},
        {"start": "18:00", "end": "19:00"}
    ]
    all_breaks = fixed_breaks if fixed_breaks else default_breaks
    # A break such as 22:00–06:00 crosses midnight. Represent it as two ranges
    # so comparisons with slots in a single day remain correct.
    break_ranges = []
    for br in all_breaks:
        br_start = parse_time(br['start'])
        br_end = parse_time(br['end'])
        if br_end <= br_start:
            break_ranges.extend(((br_start, 24 * 60), (0, br_end)))
        else:
            break_ranges.append((br_start, br_end))

    for slot in available_slots:
        start = parse_time(slot['start'])
        end = parse_time(slot['end'])
        current = start
        while current + lesson_duration <= end:
            slot_end = current + lesson_duration
            conflict = False
            for br_start, br_end in break_ranges:
                # Kiểm tra nếu slot bị dính vào giờ nghỉ
                if not (slot_end <= br_start or current >= br_end):
                    conflict = True
                    current = br_end # Nhảy tới sau giờ nghỉ
                    break

            if not conflict:
                slots.append((current, slot_end))
                current += lesson_duration
    return slots

def create_timetable_with_preferences(subjects, availability, breaks, preferences=None):
    """
    Xếp lịch dựa trên cấu trúc các slot giờ khả dụng và ưu tiên người dùng.
    preferences: {'preferred_slots': ['morning','afternoon'], 'avoid_days': [0,3], 'subject_preferences': {'Toán':'morning'}}
    """
    if preferences is None:
        preferences = {}

    all_slots = []
    for day in range(7):
        if str(day) in availability:
            # Lọc bỏ các ngày cần tránh
            if day in preferences.get('avoid_days', []):
                continue
            slots = generate_slots(availability[str(day)], breaks)
            all_slots.extend([(day, start, end) for (start, end) in slots])

    # Sắp xếp slot dựa trên ưu tiên (morning/afternoon)
    def slot_key(slot):
        day, start, end = slot
        morning = start < 12*60
        pref = preferences.get('preferred_slots', [])
        if 'morning' in pref and morning: return (0, day, start)
        if 'afternoon' in pref and not morning: return (1, day, start)
        return (2, day, start)

    all_slots.sort(key=slot_key)

    # Chuẩn bị danh sách bài học
    lessons = []
    for subj in subjects:
        for _ in range(subj.get('sessions', 0)):
            lessons.append(subj['name'])

    # Ưu tiên xếp các môn có subject_preferences trước
    subject_pref = preferences.get('subject_preferences', {})
    lessons.sort(key=lambda name: 0 if name in subject_pref else 1)

    timetable = {day: [] for day in range(7)}

    # Xếp lịch
    for lesson in lessons:
        if not all_slots: break

        # Lấy slot tốt nhất
        day, start, end = all_slots.pop(0)
        timetable[day].append({'start': start, 'end': end, 'subject': lesson})

    # Format kết quả
    days_map = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']
    result = {}
    for day in range(7):
        timetable[day].sort(key=lambda x: x['start'])
        result[days_map[day]] = [
            {'start': format_time(l['start']), 'end': format_time(l['end']), 'subject': l['subject']}
            for l in timetable[day]
        ]
    return result

# Giữ lại hàm cũ làm alias nếu app.py cần
def create_timetable(subjects, availability, breaks, special_req=""):
    return create_timetable_with_preferences(subjects, availability, breaks)
