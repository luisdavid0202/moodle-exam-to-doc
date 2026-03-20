import { normalizeMathChars } from "./normalize-math-chars"

export interface TextNode {
  type: "text"
  value: string
}

export interface ImageNode {
  type: "image"
  name: string
}

export type ContentNode = TextNode | ImageNode

export interface QuestionOption {
  letter: string
  content: ContentNode[]
}

export interface Question {
  number: number
  content: ContentNode[]
  options: QuestionOption[]
}

export interface ParsedExam {
  title: string
  questions: Question[]
}

function extractImageName(src: string): string | null {
  // Match any *_files/ folder (html_files/, delta_files/, etc.)
  const match = src.match(/\w+_files\/([^"?]+)/)
  if (!match) return null
  // URL-decode so "image%20(1).png" → "image (1).png" to match ZIP filenames
  return decodeURIComponent(match[1].trim())
}

const BLOCK_TAGS = new Set(["p", "div", "li", "ul", "ol", "h1", "h2", "h3", "h4", "blockquote"])

const SUPERSCRIPT_MAP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  "n": "ⁿ", "i": "ⁱ",
}

const SUBSCRIPT_MAP: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  "a": "ₐ", "e": "ₑ", "o": "ₒ", "x": "ₓ",
}

function toScript(text: string, map: Record<string, string>, fallbackPrefix: string): string {
  const chars = [...text]
  // If all chars have a unicode equivalent, use them
  if (chars.every((c) => map[c] !== undefined)) {
    return chars.map((c) => map[c]).join("")
  }
  // Otherwise fall back to ^text or _text notation
  return `${fallbackPrefix}${text}`
}

// Walks a DOM node recursively and produces a flat list of ContentNodes.
// Returns true if any content was actually added.
function walkNode(node: Node, nodes: ContentNode[]): boolean {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = normalizeMathChars(node.textContent ?? "")
      .replace(/\n/g, " ")       // source-code newlines → space
      .replace(/\u00a0/g, " ")  // &nbsp; → regular space (preserved individually)
    if (text.trim()) {
      appendText(nodes, text)
      return true
    }
    return false
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return false

  const el = node as Element
  const tag = el.tagName.toLowerCase()

  if (tag === "img") {
    const src = el.getAttribute("src") ?? ""
    const name = extractImageName(src)
    if (name) { nodes.push({ type: "image", name }); return true }
    return false
  }

  // <br> → explicit line break, always honoured
  if (tag === "br") {
    appendText(nodes, "\n")
    return true
  }

  if (tag === "sup") {
    const raw = normalizeMathChars(el.textContent ?? "").trim()
    if (raw) { appendText(nodes, toScript(raw, SUPERSCRIPT_MAP, "^")); return true }
    return false
  }

  if (tag === "sub") {
    const raw = normalizeMathChars(el.textContent ?? "").trim()
    if (raw) { appendText(nodes, toScript(raw, SUBSCRIPT_MAP, "_")); return true }
    return false
  }

  if (tag === "li") appendText(nodes, "• ")

  // Recurse children
  let hadContent = false
  for (const child of Array.from(node.childNodes)) {
    if (walkNode(child, nodes)) hadContent = true
  }

  // Add a single \n after a block that actually produced content.
  // This separates paragraphs/list-items without creating phantom blank lines.
  if (BLOCK_TAGS.has(tag) && hadContent) {
    appendText(nodes, "\n")
  }

  return hadContent
}

// Appends text to the last TextNode if possible, otherwise creates a new one
function appendText(nodes: ContentNode[], text: string) {
  if (nodes.length > 0 && nodes[nodes.length - 1].type === "text") {
    ;(nodes[nodes.length - 1] as TextNode).value += text
  } else {
    nodes.push({ type: "text", value: text })
  }
}

function cleanNodes(nodes: ContentNode[], stripLeadingNumber = false): ContentNode[] {
  const result: ContentNode[] = []

  for (const n of nodes) {
    if (n.type === "text") {
      let value = n.value
        .replace(/\n{2,}/g, "\n")   // collapse multiple \n → one

      // Strip leading question number like "1. " or "1) "
      if (stripLeadingNumber) {
        value = value.replace(/^\n*\d+[\.\)]\s*/, "")
        stripLeadingNumber = false  // only strip from the very first text
      }

      if (value) result.push({ type: "text", value })
    } else {
      result.push(n)
    }
  }

  // Trim leading/trailing \n from the first and last text nodes only
  for (const edge of [result[0], result[result.length - 1]]) {
    if (edge?.type === "text") {
      (edge as TextNode).value = (edge as TextNode).value.replace(/^\n+|\n+$/g, "").trim()
    }
  }

  return result.filter((n) => !(n.type === "text" && (n as TextNode).value === ""))
}

function parseContent(el: Element, stripLeadingNumber = false): ContentNode[] {
  const nodes: ContentNode[] = []
  for (const child of Array.from(el.childNodes)) {
    walkNode(child, nodes)
  }
  return cleanNodes(nodes, stripLeadingNumber)
}

export function parseExamHtml(html: string): ParsedExam {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")

  const title =
    doc.querySelector("title")?.textContent?.split("|")[0].trim() ?? "Examen"

  const questionEls = Array.from(doc.querySelectorAll("div.que"))

  const questions: Question[] = questionEls.map((queEl) => {
    const number = parseInt(
      queEl.querySelector("span.qno")?.textContent?.trim() ?? "0",
      10
    )

    const qtextEl = queEl.querySelector("div.qtext")
    const content = qtextEl ? parseContent(qtextEl, true) : []

    const optionEls = Array.from(
      queEl.querySelectorAll("div.answer [data-region='answer-label']")
    )
    const options: QuestionOption[] = optionEls.map((optEl) => {
      const letter =
        optEl
          .querySelector("span.answernumber")
          ?.textContent?.trim()
          .replace(/\.\s*$/, "") ?? ""
      const textEl = optEl.querySelector("div.flex-fill")
      const optContent = textEl ? parseContent(textEl) : []
      return { letter, content: optContent }
    })

    return { number, content, options }
  })

  return { title, questions }
}
