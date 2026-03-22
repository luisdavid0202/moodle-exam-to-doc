from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Union

from bs4 import BeautifulSoup, Comment, NavigableString, Tag

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class TextNode:
    type: str = "text"
    value: str = ""


@dataclass
class ImageNode:
    type: str = "image"
    src: str = ""  # raw src exactly as it appears in the HTML


ContentNode = Union[TextNode, ImageNode]


@dataclass
class QuestionOption:
    letter: str
    content: list[ContentNode] = field(default_factory=list)


@dataclass
class Question:
    number: int
    content: list[ContentNode] = field(default_factory=list)
    options: list[QuestionOption] = field(default_factory=list)


@dataclass
class InfoBlock:
    """Shared context block (Moodle 'description' question type)."""
    content: list[ContentNode] = field(default_factory=list)


ExamItem = Union[Question, InfoBlock]


@dataclass
class ParsedExam:
    title: str
    items: list[ExamItem] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Unicode math/script maps (sup / sub)
# ---------------------------------------------------------------------------

SUPERSCRIPT_MAP: dict[str, str] = {
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
    "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
    "n": "ⁿ", "i": "ⁱ",
}

SUBSCRIPT_MAP: dict[str, str] = {
    "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
    "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
    "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
    "a": "ₐ", "e": "ₑ", "o": "ₒ", "x": "ₓ",
}

BLOCK_TAGS = {"p", "div", "li", "ul", "ol", "h1", "h2", "h3", "h4", "blockquote"}


def _to_script(text: str, mapping: dict[str, str], fallback_prefix: str) -> str:
    chars = list(text)
    if all(c in mapping for c in chars):
        return "".join(mapping[c] for c in chars)
    return f"{fallback_prefix}{text}"


# ---------------------------------------------------------------------------
# DOM walker
# ---------------------------------------------------------------------------


def _append_text(nodes: list[ContentNode], text: str) -> None:
    if nodes and isinstance(nodes[-1], TextNode):
        nodes[-1].value += text
    else:
        nodes.append(TextNode(value=text))


def _walk(node, nodes: list[ContentNode]) -> bool:
    """Recursively walk a BS4 node and append ContentNodes. Returns True if any content was added."""
    if isinstance(node, Comment):
        return False

    if isinstance(node, NavigableString):
        # Collapse source-code newlines; keep &nbsp; as regular space
        text = str(node).replace("\n", " ").replace("\u00a0", " ")
        if text.strip():
            _append_text(nodes, text)
            return True
        return False

    if not isinstance(node, Tag):
        return False

    tag = node.name.lower() if node.name else ""

    if tag == "img":
        src = node.get("src", "")
        if src:
            nodes.append(ImageNode(src=src))
            return True
        return False

    if tag == "br":
        _append_text(nodes, "\n")
        return True

    if tag == "sup":
        raw = (node.get_text() or "").strip()
        if raw:
            _append_text(nodes, _to_script(raw, SUPERSCRIPT_MAP, "^"))
            return True
        return False

    if tag == "sub":
        raw = (node.get_text() or "").strip()
        if raw:
            _append_text(nodes, _to_script(raw, SUBSCRIPT_MAP, "_"))
            return True
        return False

    # Before entering a block element, ensure there's a line break separating it
    # from any preceding inline content (e.g. bare text node before a <p>).
    if tag in BLOCK_TAGS and nodes:
        last = nodes[-1]
        if isinstance(last, TextNode) and last.value and not last.value.endswith("\n"):
            _append_text(nodes, "\n")

    if tag == "li":
        _append_text(nodes, "• ")

    had_content = False
    for child in node.children:
        if _walk(child, nodes):
            had_content = True

    if tag in BLOCK_TAGS and had_content:
        _append_text(nodes, "\n")

    return had_content


def _clean(nodes: list[ContentNode], strip_leading_number: bool = False) -> list[ContentNode]:
    result: list[ContentNode] = []
    stripped = not strip_leading_number  # if False, we still need to strip

    for n in nodes:
        if isinstance(n, TextNode):
            value = re.sub(r"\n{2,}", "\n", n.value)
            if not stripped:
                value = re.sub(r"^\n*\d+[\.\)]\s*", "", value)
                stripped = True
            if value:
                result.append(TextNode(value=value))
        else:
            result.append(n)
            stripped = True  # don't strip after first non-text node

    # Only strip leading whitespace/newlines from the first node
    # and trailing whitespace/newlines from the last node.
    # Interior \n separators (e.g. between text and an image) must be preserved.
    if result:
        if isinstance(result[0], TextNode):
            result[0].value = result[0].value.lstrip("\n").lstrip()
        if isinstance(result[-1], TextNode):
            result[-1].value = result[-1].value.rstrip("\n").rstrip()

    return [n for n in result if not (isinstance(n, TextNode) and not n.value)]


def _parse_content(el: Tag, strip_leading_number: bool = False) -> list[ContentNode]:
    nodes: list[ContentNode] = []
    for child in el.children:
        _walk(child, nodes)
    return _clean(nodes, strip_leading_number)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def parse_exam_html(html: str) -> ParsedExam:
    soup = BeautifulSoup(html, "lxml")

    title_el = soup.find("title")
    title = title_el.get_text().split("|")[0].strip() if title_el else "Examen"

    items: list[ExamItem] = []

    for que_el in soup.find_all("div", class_="que"):
        classes = que_el.get("class", [])
        qtext_el = que_el.find("div", class_="qtext")

        if "description" in classes:
            # Shared context block — no number, no options
            content = _parse_content(qtext_el) if qtext_el else []
            if content:
                items.append(InfoBlock(content=content))
        else:
            # Regular question
            qno_el = que_el.find("span", class_="qno")
            number = int(qno_el.get_text().strip()) if qno_el else 0
            content = _parse_content(qtext_el, strip_leading_number=True) if qtext_el else []

            options: list[QuestionOption] = []
            for opt_el in que_el.select("div.answer [data-region='answer-label']"):
                letter_el = opt_el.find("span", class_="answernumber")
                letter = letter_el.get_text().strip().rstrip(". ") if letter_el else ""
                text_el = opt_el.find("div", class_="flex-fill")
                opt_content = _parse_content(text_el) if text_el else []
                options.append(QuestionOption(letter=letter, content=opt_content))

            items.append(Question(number=number, content=content, options=options))

    return ParsedExam(title=title, items=items)
