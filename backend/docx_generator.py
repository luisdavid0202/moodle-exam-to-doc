from __future__ import annotations

from io import BytesIO
from urllib.parse import unquote

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Emu, Pt
from PIL import Image as PilImage

from exam_parser import ContentNode, ImageNode, InfoBlock, ParsedExam, Question, TextNode

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FONT_NAME = "Calibri"
FONT_SIZE_PT = 11

# 96 DPI: 1 pixel = 914400/96 = 9525 EMU
PX_TO_EMU = 9525

# A4 body width: 21cm - 2×2.54cm margins = 15.92cm
MAX_WIDTH_EMU = int(15.92 / 2.54 * 914400)  # ≈ 5,703,840 EMU


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------


def _resolve_image(src: str, images: dict[str, bytes]) -> bytes | None:
    """Find image bytes by matching the src path against the images dict."""
    # 1. Exact match
    if src in images:
        return images[src]
    # 2. Strip leading ./ and URL-decode
    normalized = unquote(src.lstrip("./").replace("\\", "/"))
    if normalized in images:
        return images[normalized]
    # 3. Fallback: just the filename
    filename = normalized.split("/")[-1]
    if filename in images:
        return images[filename]
    return None


def _image_dims(img_bytes: bytes) -> tuple[int, int]:
    """Return (width_emu, height_emu) at natural pixel size, capped to page width."""
    img = PilImage.open(BytesIO(img_bytes))
    w_px, h_px = img.size
    w_emu = w_px * PX_TO_EMU
    h_emu = h_px * PX_TO_EMU
    # Only scale down — never up
    if w_emu > MAX_WIDTH_EMU:
        ratio = MAX_WIDTH_EMU / w_emu
        w_emu = MAX_WIDTH_EMU
        h_emu = int(h_emu * ratio)
    return w_emu, h_emu


# ---------------------------------------------------------------------------
# Content rendering
# ---------------------------------------------------------------------------


def _split_lines(nodes: list[ContentNode]) -> list[list[ContentNode]]:
    """Split ContentNodes at every \\n into separate lines."""
    lines: list[list[ContentNode]] = [[]]
    for node in nodes:
        if isinstance(node, TextNode):
            parts = node.value.split("\n")
            for i, part in enumerate(parts):
                if i > 0:
                    lines.append([])
                if part:
                    lines[-1].append(TextNode(value=part))
        else:
            lines[-1].append(node)
    return [line for line in lines if line]


def _build_paragraph(doc: Document, nodes: list[ContentNode], images: dict[str, bytes], indent_pt: float = 0):
    """Create a paragraph in the document from a single line of ContentNodes."""
    para = doc.add_paragraph()
    if indent_pt:
        para.paragraph_format.left_indent = Pt(indent_pt)
    para.paragraph_format.space_after = Pt(0)

    for node in nodes:
        if isinstance(node, TextNode):
            run = para.add_run(node.value)
            run.font.name = FONT_NAME
            run.font.size = Pt(FONT_SIZE_PT)
        elif isinstance(node, ImageNode):
            img_bytes = _resolve_image(node.src, images)
            if img_bytes:
                try:
                    w_emu, h_emu = _image_dims(img_bytes)
                    run = para.add_run()
                    run.add_picture(BytesIO(img_bytes), width=Emu(w_emu), height=Emu(h_emu))
                except Exception:
                    # If image can't be loaded, insert placeholder text
                    run = para.add_run(f"[imagen: {node.src}]")
                    run.font.name = FONT_NAME
                    run.font.size = Pt(FONT_SIZE_PT)

    return para


def _render_nodes(doc: Document, nodes: list[ContentNode], images: dict[str, bytes], indent_pt: float = 0) -> None:
    """Render a list of ContentNodes as one paragraph per line."""
    for line in _split_lines(nodes):
        _build_paragraph(doc, line, images, indent_pt)


def _add_divider(doc: Document) -> None:
    """Add a horizontal rule paragraph."""
    para = doc.add_paragraph()
    para.paragraph_format.space_before = Pt(10)
    para.paragraph_format.space_after = Pt(10)
    pPr = para._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "AAAAAA")
    pBdr.append(bottom)
    pPr.append(pBdr)


def _render_info_block(doc: Document, item: InfoBlock, images: dict[str, bytes]) -> None:
    """Render an InfoBlock: first line bold+large (the 'Preguntas X a Y' header), rest normal."""
    lines = _split_lines(item.content)
    for i, line in enumerate(lines):
        para = doc.add_paragraph()
        para.paragraph_format.space_after = Pt(0)
        if i == 0:
            # Header line — bold, larger
            para.paragraph_format.space_before = Pt(4)
            for node in line:
                if isinstance(node, TextNode):
                    run = para.add_run(node.value)
                    run.bold = True
                    run.font.name = FONT_NAME
                    run.font.size = Pt(13)
                elif isinstance(node, ImageNode):
                    img_bytes = _resolve_image(node.src, images)
                    if img_bytes:
                        try:
                            w_emu, h_emu = _image_dims(img_bytes)
                            para.add_run().add_picture(BytesIO(img_bytes), width=Emu(w_emu), height=Emu(h_emu))
                        except Exception:
                            para.add_run(f"[imagen: {node.src}]")
        else:
            _build_paragraph(doc, line, images)


# ---------------------------------------------------------------------------
# Document generation
# ---------------------------------------------------------------------------


def generate_docx(exam: ParsedExam, images: dict[str, bytes]) -> bytes:
    doc = Document()

    # Remove the default empty paragraph Word always adds
    for para in list(doc.paragraphs):
        para._element.getparent().remove(para._element)

    # Title
    title_para = doc.add_paragraph()
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_para.paragraph_format.space_after = Pt(12)
    run = title_para.add_run(exam.title)
    run.bold = True
    run.font.name = FONT_NAME
    run.font.size = Pt(14)

    for i, item in enumerate(exam.items):
        if i > 0:
            _add_divider(doc)

        if isinstance(item, InfoBlock):
            _render_info_block(doc, item, images)

        elif isinstance(item, Question):
            # Question number
            num_para = doc.add_paragraph()
            num_para.paragraph_format.space_before = Pt(12)
            num_para.paragraph_format.space_after = Pt(0)
            run = num_para.add_run(f"Ejercicio {item.number}.")
            run.bold = True
            run.font.name = FONT_NAME
            run.font.size = Pt(FONT_SIZE_PT)

            # Question body
            _render_nodes(doc, item.content, images)

            # Answer options — letter and answer text on the same line
            for opt in item.options:
                lines = _split_lines(opt.content) if opt.content else []

                # First paragraph: "A. " + first line of content, no indent
                opt_para = doc.add_paragraph()
                opt_para.paragraph_format.space_after = Pt(0)
                letter_run = opt_para.add_run(f"{opt.letter}. ")
                letter_run.bold = True
                letter_run.font.name = FONT_NAME
                letter_run.font.size = Pt(FONT_SIZE_PT)

                if lines:
                    for node in lines[0]:
                        if isinstance(node, TextNode):
                            r = opt_para.add_run(node.value)
                            r.font.name = FONT_NAME
                            r.font.size = Pt(FONT_SIZE_PT)
                        elif isinstance(node, ImageNode):
                            img_bytes = _resolve_image(node.src, images)
                            if img_bytes:
                                try:
                                    w_emu, h_emu = _image_dims(img_bytes)
                                    opt_para.add_run().add_picture(BytesIO(img_bytes), width=Emu(w_emu), height=Emu(h_emu))
                                except Exception:
                                    opt_para.add_run(f"[imagen: {node.src}]")
                    # Remaining lines (if multi-line answer) indented to align with content
                    for line in lines[1:]:
                        _build_paragraph(doc, line, images, indent_pt=18)

    buf = BytesIO()
    doc.save(buf)
    return buf.getvalue()
