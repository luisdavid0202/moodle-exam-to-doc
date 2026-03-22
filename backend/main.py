from __future__ import annotations

import io
import zipfile
from urllib.parse import unquote

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from docx_generator import generate_docx
from exam_parser import parse_exam_html

app = FastAPI(title="Moodle Exam to Doc API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/convert")
async def convert(
    html_file: UploadFile = File(...),
    zip_file: UploadFile = File(...),
    format: str = Form(default="docx"),
):
    if format != "docx":
        raise HTTPException(status_code=400, detail=f"Formato '{format}' no soportado aún. Usa 'docx'.")

    html_bytes = await html_file.read()
    html = html_bytes.decode("utf-8", errors="replace")

    zip_bytes = await zip_file.read()
    images: dict[str, bytes] = {}

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for name in zf.namelist():
            # Skip directories and macOS metadata
            if name.endswith("/"):
                continue
            filename = name.split("/")[-1]
            if not filename or filename.startswith("._") or name.startswith("__MACOSX"):
                continue
            ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
            if ext not in {"png", "jpg", "jpeg", "gif", "bmp", "webp"}:
                continue

            img_bytes = zf.read(name)
            # Store by full path (URL-decoded) for exact src matching
            normalized = unquote(name.lstrip("./"))
            images[normalized] = img_bytes
            # Also store by filename alone as fallback
            images[unquote(filename)] = img_bytes

    exam = parse_exam_html(html)
    docx_bytes = generate_docx(exam, images)

    safe_title = "".join(c for c in exam.title if c.isalnum() or c in " _-").strip() or "examen"
    filename = f"{safe_title}.docx"
    media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    return Response(
        content=docx_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
