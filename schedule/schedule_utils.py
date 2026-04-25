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
