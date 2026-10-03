"""Cấu hình pytest: đưa thư mục gốc dự án vào sys.path để `import app` hoạt động."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
