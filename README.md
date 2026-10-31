# Test Evidence Extension

Professional **test-evidence capture** toolkit:

1. **Chrome / Edge browser extension** (Manifest V3) – capture screenshots, page metadata, tags, notes, status; edit/delete; filter; export JSON or self-contained HTML report; keyboard shortcuts.
2. **Python CLI** – record evidence from the terminal, list records, export HTML reports, import extension exports.

No placeholders or TODOs. Ready for local use on Windows 10/11.

---

## Features

### Browser extension
- Screenshot of the visible tab (PNG)
- Structured metadata: test name, expected/actual, status (PASS / FAIL / BLOCKED / SKIP), tags, notes
- Automatic page title, URL, user agent, viewport
- Edit / delete individual records
- Filter by text or status
- Export full JSON (including screenshots as data URLs)
- Export standalone HTML report (open in any browser)
- Download individual screenshots as PNG
- Clear-all with confirmation
- Keyboard shortcuts:
  - **Alt+Shift+E** – capture hint on page
  - **Alt+Shift+S** – quick capture (defaults + screenshot)
- Dark, compact popup UI

### Python tools
- Interactive or non-interactive recording into `evidence.json`
- List records, export HTML report
- Import JSON exported from the extension (`scripts/import_extension_export.py`)

---

## Prerequisites (Windows 10 / 11)

| Tool | Notes |
|------|--------|
| **Python 3.10+** | [python.org](https://www.python.org/downloads/) – check **“Add python.exe to PATH”** during install |
| **Google Chrome** or **Microsoft Edge** | For loading the unpacked extension |
| **Git** (optional) | Only if you clone instead of using the zip |

Verify Python:

```powershell
python --version
# or
py --version
```

---

## Project layout

```
Test-Evidence-Extension/
├── README.md
├── requirements.txt
├── .gitignore
├── evidence_recorder.py      # CLI recorder / list / export
├── evidence.json             # created at runtime (gitignored)
├── extension/
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── scripts/
│   └── import_extension_export.py
└── tests/
    └── test_evidence_recorder.py
```

---

## Setup – virtual environment (PowerShell)

Open **PowerShell** in the project root (folder that contains `evidence_recorder.py`).

```powershell
# Create virtual environment
python -m venv .venv

# Activate (PowerShell)
.\.venv\Scripts\Activate.ps1
```

If execution policy blocks activation:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
.\.venv\Scripts\Activate.ps1
```

**Command Prompt** alternative:

```cmd
python -m venv .venv
.venv\Scripts\activate.bat
```

You should see `(.venv)` in the prompt.

---

## Install dependencies

With the venv activated:

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

(`pytest` is the only third-party dependency; the CLI itself uses the standard library.)

---

## Run unit tests

```powershell
pytest -v
```

Expected: all tests pass.

---

## Use the Python CLI

**Interactive:**

```powershell
python evidence_recorder.py
```

**Non-interactive:**

```powershell
python evidence_recorder.py --test "Login valid user" --status PASS --expected "Dashboard" --actual "Dashboard shown" --tags "smoke,login"
```

**List:**

```powershell
python evidence_recorder.py --list
```

**HTML report:**

```powershell
python evidence_recorder.py --export-html report.html
```

**Import extension export:**

```powershell
python scripts/import_extension_export.py path\to\test-evidence-2026-10-31.json
# or merge:
python scripts/import_extension_export.py path\to\export.json --merge
```

---

## Load the browser extension (Windows)

### Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension` folder inside this project  
   (full path example: `C:\Users\You\Projects\Test-Evidence-Extension\extension`)
5. The “Test Evidence Extension” icon appears in the toolbar (pin it if needed)

### Microsoft Edge

1. Go to `edge://extensions/`
2. Enable **Developer mode**
3. **Load unpacked** → select the same `extension` folder

### Shortcuts

| Shortcut | Action |
|----------|--------|
| Alt+Shift+E | Show capture hint on the page |
| Alt+Shift+S | Quick evidence capture (screenshot + defaults) |

You can change shortcuts at `chrome://extensions/shortcuts` (or Edge equivalent).

### Capture workflow

1. Open the page under test
2. Click the extension icon
3. Fill **Test Name** (required), expected/actual, status, tags, notes
4. Click **Record Evidence** – a screenshot is taken and stored with metadata
5. Use **Export JSON** or **Export Report** when finished
6. Optionally import the JSON into the Python `evidence.json` via the import script

**Note:** `chrome.storage.local` has a size limit (typically ~10 MB). Large numbers of high-resolution screenshots may require periodic export + clear.

---

## Deactivate the virtual environment

```powershell
deactivate
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Activate.ps1` cannot be loaded | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `python` not found | Reinstall Python with “Add to PATH”, or use `py -3` |
| Screenshot fails | Ensure the tab is not a restricted page (`chrome://`, Web Store). Grant tab permission by interacting with the page first. |
| Content script errors | Reload the extension on `chrome://extensions/` after code changes |
| Storage full | Export JSON, then **Clear All** in the popup |

---

## Version

**2.0.0** – full capture UI, tags, filters, exports, shortcuts, Python CLI + tests.
