import http.server
import socketserver
import threading
import json
import subprocess
import os
import sys
import time
from pathlib import Path

PORT = 5566
BASE_DIR = Path("/home/thanh/LÀM VIỆC/project/studyverse")
OUTPUT_DIR = BASE_DIR / ".agents/teamwork/explorer_m2_1"

results = {}

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_POST(self):
        if self.path == '/api/report_layout':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            results.update(data)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass # suppress logs

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

# Create test runner HTML
runner_html = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Measure 375px</title>
<style>
body { margin: 0; padding: 0; overflow-x: hidden; }
iframe { width: 375px; height: 812px; border: none; }
</style>
</head>
<body>
<iframe id="testFrame"></iframe>
<script>
const pages = [
  'index.html',
  'account.html',
  'career/chat.html',
  'flashcard/flashcard.html',
  'schedule/create.html',
  'todo/mylist.html'
];
const allResults = {};

async function measurePage(page) {
  return new Promise((resolve) => {
    const frame = document.getElementById('testFrame');
    frame.src = '/' + page;
    frame.onload = () => {
      setTimeout(() => {
        try {
          const doc = frame.contentDocument;
          const win = frame.contentWindow;
          const res = {
            viewport: { innerWidth: win.innerWidth, innerHeight: win.innerHeight },
            body: {
              scrollWidth: doc.body.scrollWidth,
              clientWidth: doc.body.clientWidth,
              hasHorizontalOverflow: doc.body.scrollWidth > doc.body.clientWidth
            }
          };

          const navbar = doc.querySelector('.navbar, .account-topbar');
          if (navbar) {
            const nbRect = navbar.getBoundingClientRect();
            res.navbar = {
              tag: navbar.tagName,
              className: navbar.className,
              rect: { width: nbRect.width, height: nbRect.height, top: nbRect.top, left: nbRect.left },
              scrollWidth: navbar.scrollWidth,
              clientWidth: navbar.clientWidth,
              overflow: navbar.scrollWidth > navbar.clientWidth
            };
          }

          const container = doc.querySelector('.nav-container');
          if (container) {
            const cRect = container.getBoundingClientRect();
            const cs = win.getComputedStyle(container);
            res.navContainer = {
              rect: { width: cRect.width, height: cRect.height },
              scrollWidth: container.scrollWidth,
              clientWidth: container.clientWidth,
              overflow: container.scrollWidth > container.clientWidth,
              flexWrap: cs.flexWrap,
              justifyContent: cs.justifyContent,
              padding: cs.padding
            };
          }

          const logo = doc.querySelector('.logo, .account-brand');
          if (logo) {
            const lRect = logo.getBoundingClientRect();
            const ls = win.getComputedStyle(logo);
            res.logo = {
              text: logo.innerText.trim(),
              rect: { width: lRect.width, height: lRect.height },
              fontSize: ls.fontSize,
              whiteSpace: ls.whiteSpace,
              isMultiLine: lRect.height > 30
            };
          }

          const nav = doc.querySelector('.navigation');
          if (nav) {
            const nRect = nav.getBoundingClientRect();
            res.navigation = {
              rect: { width: nRect.width, height: nRect.height },
              scrollWidth: nav.scrollWidth,
              clientWidth: nav.clientWidth,
              items: []
            };
            const items = nav.querySelectorAll('li');
            items.forEach((li, idx) => {
              const r = li.getBoundingClientRect();
              const a = li.querySelector('a');
              const aRect = a ? a.getBoundingClientRect() : null;
              res.navigation.items.push({
                index: idx,
                id: li.id,
                className: li.className,
                rect: { width: r.width, height: r.height },
                aRect: aRect ? { width: aRect.width, height: aRect.height } : null,
                tapTargetValid44: (aRect ? (aRect.width >= 44 && aRect.height >= 44) : (r.width >= 44 && r.height >= 44))
              });
            });
          }

          const streak = doc.querySelector('.nav-streak-container, .nav-streak-btn');
          if (streak) {
            const sBtn = doc.querySelector('.nav-streak-btn');
            const sRect = (sBtn || streak).getBoundingClientRect();
            res.streakBtn = {
              rect: { width: sRect.width, height: sRect.height },
              tapTargetValid44: (sRect.width >= 44 && sRect.height >= 44)
            };
          }

          const account = doc.querySelector('.nav-account, .account-back-link');
          if (account) {
            const aRect = account.getBoundingClientRect();
            res.accountBtn = {
              text: account.innerText.trim(),
              rect: { width: aRect.width, height: aRect.height },
              tapTargetValid44: (aRect.width >= 44 && aRect.height >= 44)
            };
          }

          const settings = doc.querySelector('.nav-settings');
          if (settings) {
            const sRect = settings.getBoundingClientRect();
            res.settingsBtn = {
              rect: { width: sRect.width, height: sRect.height },
              tapTargetValid44: (sRect.width >= 44 && sRect.height >= 44)
            };
          }

          allResults[page] = res;
          resolve();
        } catch (e) {
          allResults[page] = { error: e.message };
          resolve();
        }
      }, 500);
    };
  });
}

async function runAll() {
  for (const page of pages) {
    await measurePage(page);
  }
  await fetch('/api/report_layout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(allResults)
  });
}
window.onload = runAll;
</script>
</body>
</html>
"""

(BASE_DIR / ".agents/teamwork/explorer_m2_1/runner.html").write_text(runner_html, encoding='utf-8')

# Start server in thread
server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()
print("Server started on port", PORT)

# Run Firefox headless to load runner.html
profile_dir = OUTPUT_DIR / "ff_profile"
cmd = [
    "firefox", "--headless", "--no-remote",
    "--profile", str(profile_dir),
    f"--window-size=375,812",
    f"http://127.0.0.1:{PORT}/.agents/teamwork/explorer_m2_1/runner.html"
]

proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

# Wait up to 25 seconds for results
start_time = time.time()
while time.time() - start_time < 25:
    if results:
        break
    time.sleep(0.5)

proc.terminate()

with open(OUTPUT_DIR / "layout_measurements.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print(f"Captured results for {len(results)} pages:")
for page, data in results.items():
    print(f"--- {page} ---")
    if 'error' in data:
        print("Error:", data['error'])
        continue
    nb = data.get('navbar', {})
    nc = data.get('navContainer', {})
    logo = data.get('logo', {})
    nav = data.get('navigation', {})
    streak = data.get('streakBtn', {})
    account = data.get('accountBtn', {})
    settings = data.get('settingsBtn', {})
    print(f"  Navbar: {nb.get('rect', {})} (overflow: {nb.get('overflow')})")
    print(f"  NavContainer: {nc.get('rect', {})} (overflow: {nc.get('overflow')}, flexWrap: {nc.get('flexWrap')})")
    print(f"  Logo: {logo.get('text')} rect: {logo.get('rect', {})} multiLine: {logo.get('isMultiLine')}")
    if nav:
        items = nav.get('items', [])
        valid_items = sum(1 for it in items if it.get('tapTargetValid44'))
        print(f"  Nav Tabs: width={nav.get('rect', {}).get('width')}, items={len(items)}, tapTargets>=44px: {valid_items}/{len(items)}")
        for it in items:
            print(f"    Tab {it.get('index')}: rect={it.get('rect')}, aRect={it.get('aRect')}, valid44={it.get('tapTargetValid44')}")
    if streak:
        print(f"  StreakBtn: rect={streak.get('rect')}, valid44={streak.get('tapTargetValid44')}")
    if account:
        print(f"  AccountBtn: rect={account.get('rect')}, valid44={account.get('tapTargetValid44')}")
    if settings:
        print(f"  SettingsBtn: rect={settings.get('rect')}, valid44={settings.get('tapTargetValid44')}")
