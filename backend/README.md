# Backend — Moodle Exam to Doc

REST API built with **FastAPI** and **Python 3.9+**.

Accepts a Moodle quiz HTML export and a ZIP of its images, parses the questions, and generates a print-ready `.docx` document.

## Requirements

- Python 3.9+

## Setup

```bash
python -m venv .venv
pip install -r requirements.txt
```

Activate the virtual environment before running:

| Platform | Command |
|----------|---------|
| macOS / Linux | `source .venv/bin/activate` |
| Windows (cmd) | `.venv\Scripts\activate.bat` |
| Windows (PowerShell) | `.venv\Scripts\Activate.ps1` |

## Running

```bash
uvicorn main:app --reload
# API available at http://localhost:8000
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/convert` | Convert HTML + ZIP → `.docx` |

### POST `/convert`

`multipart/form-data` parameters:

| Field | Type | Description |
|-------|------|-------------|
| `html_file` | file | HTML exported from Moodle |
| `zip_file` | file | ZIP containing the quiz images |
| `format` | string | Output format (`docx` only) |

Returns the `.docx` file as a download.

## File structure

| File | Description |
|------|-------------|
| `main.py` | FastAPI server and `/convert` endpoint |
| `exam_parser.py` | Parses Moodle HTML into a data model |
| `docx_generator.py` | Generates the `.docx` from the data model |
| `requirements.txt` | Python dependencies |
