"""Test thuật toán xếp lịch trong schedule/schedule_utils.py."""
from schedule.schedule_utils import (
    create_timetable_with_preferences,
    format_time,
    generate_slots,
    parse_time,
)


def test_parse_and_format_time():
    assert parse_time('07:30') == 450
    assert format_time(450) == '07:30'
    assert format_time(0) == '00:00'
    assert format_time(23 * 60 + 59) == '23:59'


def test_generate_slots_respects_lesson_duration():
    slots = generate_slots([{'start': '07:00', 'end': '09:00'}], [], lesson_duration=45)
    assert slots[0] == (parse_time('07:00'), parse_time('07:45'))
    # 2 giờ / 45 phút = 2 tiết trọn vẹn
    assert len(slots) == 2


def test_generate_slots_skips_breaks():
    breaks = [{'start': '08:00', 'end': '08:30'}]
    slots = generate_slots([{'start': '07:00', 'end': '10:00'}], breaks, lesson_duration=30)
    for start, end in slots:
        assert end <= parse_time('08:00') or start >= parse_time('08:30')


def test_overnight_break_split_across_midnight():
    # Không truyền breaks -> dùng mặc định gồm 22:00–06:00 vắt qua nửa đêm
    slots = generate_slots([{'start': '05:00', 'end': '07:00'}], [], lesson_duration=30)
    # 05:00–06:00 nằm trong giờ nghỉ mặc định => chỉ còn các tiết từ 06:00 trở đi
    assert all(start >= parse_time('06:00') for start, _ in slots)


def test_timetable_places_all_lessons():
    subjects = [{'name': 'Toán', 'sessions': 3}, {'name': 'Lý', 'sessions': 2}]
    availability = {'0': [{'start': '07:00', 'end': '11:00'}]}
    result = create_timetable_with_preferences(subjects, availability, [], lesson_duration=45)
    assert len(result) == 7
    placed = [lesson for day in result for lesson in day]
    assert len(placed) == 5
    assert sum(1 for l in placed if l['subject'] == 'Toán') == 3


def test_timetable_respects_avoid_days():
    subjects = [{'name': 'Toán', 'sessions': 2}]
    availability = {'0': [{'start': '07:00', 'end': '11:00'}], '1': [{'start': '07:00', 'end': '11:00'}]}
    result = create_timetable_with_preferences(
        subjects, availability, [], preferences={'avoid_days': [0]}, lesson_duration=45
    )
    assert result[0] == []
    assert len(result[1]) == 2


def test_timetable_prefers_morning():
    subjects = [{'name': 'Toán', 'sessions': 1}]
    availability = {
        '0': [{'start': '07:00', 'end': '09:00'}],
        '1': [{'start': '14:00', 'end': '16:00'}],
    }
    result = create_timetable_with_preferences(
        subjects, availability, [], preferences={'preferred_slots': ['morning']}, lesson_duration=45
    )
    assert result[0], 'Tiết buổi sáng phải được xếp trước'


def test_timetable_handles_not_enough_slots():
    subjects = [{'name': 'Toán', 'sessions': 10}]
    availability = {'0': [{'start': '07:00', 'end': '08:00'}]}
    result = create_timetable_with_preferences(subjects, availability, [], lesson_duration=45)
    placed = [lesson for day in result for lesson in day]
    assert len(placed) == 1  # chỉ đủ chỗ cho 1 tiết, không được lỗi
