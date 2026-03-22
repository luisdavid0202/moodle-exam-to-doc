import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
} from "docx"
import { ContentNode, ParsedExam, Question, TextNode } from "./parser"
import { ImageData } from "./pdf-generator"

const PX_TO_PT = 0.75
const MAX_WIDTH_PT = 460  // ~A4 content width in pt

function scaleImage(data: ImageData): { width: number; height: number } {
  const w = data.width * PX_TO_PT
  const h = data.height * PX_TO_PT
  if (w <= MAX_WIDTH_PT) return { width: w, height: h }
  const ratio = MAX_WIDTH_PT / w
  return { width: MAX_WIDTH_PT, height: h * ratio }
}

function base64ToUint8Array(src: string): Uint8Array {
  // src is "data:image/png;base64,XXXX"
  const b64 = src.split(",")[1]
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function mimeToExtension(src: string): "png" | "jpg" | "gif" | "bmp" {
  if (src.startsWith("data:image/gif")) return "gif"
  if (src.startsWith("data:image/jpeg") || src.startsWith("data:image/jpg")) return "jpg"
  return "png"
}

// A "segment" is either a run of text or an image inline
type Segment =
  | { kind: "text"; value: string }
  | { kind: "image"; name: string }

// Split ContentNode[] into lines (by \n), each line into segments
function splitIntoLineSegments(nodes: ContentNode[]): Segment[][] {
  const lines: Segment[][] = [[]]

  for (const node of nodes) {
    if (node.type === "text") {
      const parts = (node as TextNode).value.split("\n")
      parts.forEach((part, i) => {
        if (i > 0) lines.push([])
        if (part) lines[lines.length - 1].push({ kind: "text", value: part })
      })
    } else {
      lines[lines.length - 1].push({ kind: "image", name: node.name })
    }
  }

  return lines.filter((l) => l.length > 0)
}

function segmentsToParagraph(
  segments: Segment[],
  images: Record<string, ImageData>,
  options: { indent?: number } = {}
): Paragraph {
  const children: (TextRun | ImageRun)[] = []

  for (const seg of segments) {
    if (seg.kind === "text") {
      children.push(new TextRun({ text: seg.value, size: 22 }))
    } else {
      const data = images[seg.name]
      if (!data) continue
      const { width, height } = scaleImage(data)
      const bytes = base64ToUint8Array(data.src)
      const ext = mimeToExtension(data.src)
      children.push(
        new ImageRun({
          data: bytes,
          transformation: {
            width: Math.round(width),   // pt (docx lib treats as pt internally)
            height: Math.round(height),
          },
          type: ext,
        })
      )
    }
  }

  return new Paragraph({
    children,
    indent: options.indent ? { left: options.indent } : undefined,
    spacing: { after: 0 },
  })
}

function renderContentNodes(
  nodes: ContentNode[],
  images: Record<string, ImageData>,
  indent = 0
): Paragraph[] {
  const lineGroups = splitIntoLineSegments(nodes)
  return lineGroups.map((segs) =>
    segmentsToParagraph(segs, images, { indent })
  )
}

function questionToParagraphs(
  question: Question,
  images: Record<string, ImageData>
): Paragraph[] {
  const paragraphs: Paragraph[] = []

  // Question number line
  paragraphs.push(
    new Paragraph({
      children: [new TextRun({ text: `${question.number}.`, bold: true, size: 22 })],
      spacing: { before: 200, after: 0 },
    })
  )

  // Question content
  paragraphs.push(...renderContentNodes(question.content, images))

  // Options
  for (const opt of question.options) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: `${opt.letter}.`, bold: true, size: 22 })],
        indent: { left: 360 },
        spacing: { after: 0 },
      })
    )
    paragraphs.push(...renderContentNodes(opt.content, images, 720))
  }

  return paragraphs
}

export async function generateDocx(
  exam: ParsedExam,
  images: Record<string, ImageData>
): Promise<Blob> {
  const allParagraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: exam.title, bold: true, size: 28 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  ]

  for (const question of exam.questions) {
    allParagraphs.push(...questionToParagraphs(question, images))
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: allParagraphs,
      },
    ],
  })

  const buffer = await Packer.toBlob(doc)
  return buffer
}
