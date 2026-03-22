# Moodle Exam to Doc

Converts Moodle quiz exports (HTML format) into Word `.docx` documents, preserving questions, answer options, and images.

## Structure

```
├── frontend/   # Web interface (Next.js)
└── backend/    # Conversion API (FastAPI + Python)
```

Each folder has its own `README.md` with setup and usage instructions.

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
pip install -r requirements.txt
```

Activate the virtual environment:

| Platform | Command |
|----------|---------|
| macOS / Linux | `source .venv/bin/activate` |
| Windows (cmd) | `.venv\Scripts\activate.bat` |
| Windows (PowerShell) | `.venv\Scripts\Activate.ps1` |

Then start the server:

```bash
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), upload the `.html` file and its `.zip` image bundle, and download the generated document.
