import random

def parse_time(time_str):
    h, m = map(int, time_str.split(':'))
    return h * 60 + m

def format_time(minutes):
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"

def generate_slots(available_slots, fixed_breaks, lesson_duration=45):
    slots = []
    default_breaks = [
        {"start": "22:00", "end": "06:00"},
        {"start": "06:30", "end": "07:00"},
        {"start": "11:30", "end": "12:30"},
        {"start": "18:00", "end": "19:00"}
    ]
    all_breaks = fixed_breaks if fixed_breaks else default_breaks
    
    for slot in available_slots:
        start = parse_time(slot['start'])
        end = parse_time(slot['end'])
        current = start
        while current + lesson_duration <= end:
            slot_start = current
            slot_end = current + lesson_duration
            conflict = False
            for br in all_breaks:
                br_start = parse_time(br['start'])
                br_end = parse_time(br['end'])
                if not (slot_end <= br_start or slot_start >= br_end):
                    conflict = True
                    current = br_end
                    break
            if not conflict:
                slots.append((slot_start, slot_end))
                current += lesson_duration
    return slots

def create_timetable(subjects, availability, breaks, special_req=""):
    timetable = {day: [] for day in range(7)}
    lessons = []
    for subj in subjects:
        for _ in range(subj['sessions']):
            lessons.append(subj['name'])
    random.shuffle(lessons)
    
    daily_slots = {}
    for day in range(7):
        if str(day) in availability:
            daily_slots[day] = generate_slots(availability[str(day)], breaks)
        else:
            daily_slots[day] = []
    
    for lesson in lessons:
        placed = False
        for day in sorted(range(7), key=lambda d: len(daily_slots[d]), reverse=True):
            if daily_slots[day] and not placed:
                slot = daily_slots[day].pop(0)
                timetable[day].append({'start': slot[0], 'end': slot[1], 'subject': lesson})
                placed = True
    
    for day in timetable:
        timetable[day].sort(key=lambda x: x['start'])
    
    # Format lại
    days_map = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']
    result = {}
    for day in range(7):
        result[days_map[day]] = [{'start': format_time(l['start']), 'end': format_time(l['end']), 'subject': l['subject']} for l in timetable[day]]
    return result
def create_timetable_with_preferences(subjects, availability, breaks, preferences):
    """
    preferences: dict với các key:
        - preferred_slots: list ['morning', 'afternoon']
        - avoid_days: list [0,1,...] chỉ số thứ cần tránh
        - subject_preferences: dict {'Toán': 'morning', ...}
    """
    # ... code xếp lịch ưu tiên theo yêu cầu
def create_timetable_with_preferences(subjects, availability, breaks, preferences):
    """
    Xếp lịch dựa trên preferences (fallback khi AI lỗi)
    preferences: {'preferred_slots': ['morning','afternoon'], 'avoid_days': [0,3], 'subject_preferences': {'Toán':'morning'}}
    """
    from datetime import datetime
    # Tạo danh sách tất cả các slot giờ
    all_slots = []
    for day in range(7):
        if str(day) in availability:
            slots = generate_slots(availability[str(day)], breaks)
            all_slots.extend([(day, start, end) for (start, end) in slots])
    
    # Sắp xếp slot ưu tiên: buổi sáng (start < 12:00) trước, chiều sau
def slot_key(slot):
    day, start, end = slot
    morning = start < 12*60
    if 'morning' in preferences.get('preferred_slots', []) and morning:
        return (0, day, start)
    elif 'afternoon' in preferences.get('preferred_slots', []) and not morning:
        return (1, day, start)
    else:
        return (2, day, start)
    
    # Lọc bỏ các ngày tránh
    avoid_days = preferences.get('avoid_days', [])
    filtered_slots = [s for s in all_slots if s[0] not in avoid_days]
    filtered_slots.sort(key=slot_key)
    
    # Tạo danh sách bài học cần xếp (lặp lại môn theo số tiết)
    lessons = []
    for subj in subjects:
        for _ in range(subj['sessions']):
            lessons.append(subj['name'])
    random.shuffle(lessons)
    
    # Ưu tiên xếp các môn có subject_preferences trước
    subject_pref = preferences.get('subject_preferences', {})
    lessons.sort(key=lambda name: 0 if name in subject_pref else 1)
    
    timetable = {day: [] for day in range(7)}
    slot_index = 0
    for lesson in lessons:
        if slot_index >= len(filtered_slots):
            break
        day, start, end = filtered_slots[slot_index]
        timetable[day].append({'start': start, 'end': end, 'subject': lesson})
        slot_index += 1
    
    # Format lại kết quả
    days_map = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']
    result = {}
    for day in range(7):
        result[days_map[day]] = [{'start': format_time(l['start']), 'end': format_time(l['end']), 'subject': l['subject']} for l in timetable[day]]
    return result
