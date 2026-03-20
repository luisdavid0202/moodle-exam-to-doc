import React from "react"
import {
  Document,
  Font,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer"
import { ContentNode, ParsedExam, Question, TextNode } from "./parser"

Font.register({
  family: "FreeSans",
  src: "/fonts/FreeSans.ttf",
})

const PX_TO_PT = 0.75 // 1px ≈ 0.75pt

export interface ImageData {
  src: string
  width: number  // natural width in px
  height: number // natural height in px
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
    fontFamily: "FreeSans",
    fontSize: 11,
    lineHeight: 1.5,
    color: "#111",
  },
  title: {
    fontSize: 14,
    fontFamily: "FreeSans",
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },
  question: {
    marginBottom: 20,
  },
  questionNumber: {
    fontFamily: "FreeSans",
    fontWeight: "bold",
    marginBottom: 4,
  },
  text: {
    marginBottom: 2,
  },
  blockImage: {
    marginVertical: 6,
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 2,
  },
  optionsBlock: {
    marginTop: 6,
    marginLeft: 12,
  },
  option: {
    flexDirection: "row",
    marginBottom: 2,
  },
  optionLetter: {
    fontFamily: "FreeSans",
    fontWeight: "bold",
    marginRight: 4,
    width: 20,
  },
  optionText: {
    flex: 1,
  },
})

function naturalImageStyle(data: ImageData, extraStyle = {}) {
  return {
    ...extraStyle,
    width: data.width * PX_TO_PT,
    height: data.height * PX_TO_PT,
  }
}

// Split flat ContentNode[] into "lines" by splitting text nodes at \n.
// Each line is an array of ContentNode (text without \n, or images).
type Line = ContentNode[]

function splitIntoLines(nodes: ContentNode[]): Line[] {
  const lines: Line[] = [[]]

  for (const node of nodes) {
    if (node.type === "text") {
      const parts = (node as TextNode).value.split("\n")
      parts.forEach((part, i) => {
        if (i > 0) lines.push([])
        if (part) lines[lines.length - 1].push({ type: "text", value: part })
      })
    } else {
      lines[lines.length - 1].push(node)
    }
  }

  return lines.filter((line) => line.length > 0)
}

function renderLines(
  nodes: ContentNode[],
  images: Record<string, ImageData>,
  prefix: string
): React.ReactElement[] {
  const lines = splitIntoLines(nodes)
  const elements: React.ReactElement[] = []

  lines.forEach((line, lineIdx) => {
    const lineKey = `${prefix}-l${lineIdx}`
    const hasImage = line.some((n) => n.type === "image")

    if (!hasImage) {
      // Pure text line
      const text = line
        .filter((n) => n.type === "text")
        .map((n) => (n as TextNode).value)
        .join("")
      if (text.trim()) {
        elements.push(
          <Text key={lineKey} style={styles.text}>
            {text}
          </Text>
        )
      }
      return
    }

    // Line with inline image(s) — render as flex row
    const isOnlyImages = line.every((n) => n.type === "image")

    if (isOnlyImages) {
      // Block image(s) — centered, full width treatment
      line.forEach((node, i) => {
        const data = images[(node as { name: string }).name]
        if (!data) return
        elements.push(
          <Image key={`${lineKey}-${i}`} src={data.src} style={naturalImageStyle(data, styles.blockImage)} />
        )
      })
      return
    }

    // Mixed text + image → inline row
    const rowItems: React.ReactElement[] = []

    line.forEach((node, i) => {
      const itemKey = `${lineKey}-${i}`
      if (node.type === "image") {
        const data = images[node.name]
        if (!data) return
        rowItems.push(
          <Image key={itemKey} src={data.src} style={naturalImageStyle(data)} />
        )
      } else {
        const value = (node as TextNode).value
        if (value) {
          rowItems.push(
            <Text key={itemKey} style={styles.text}>
              {value}
            </Text>
          )
        }
      }
    })

    if (rowItems.length > 0) {
      elements.push(
        <View key={lineKey} style={styles.inlineRow}>
          {rowItems}
        </View>
      )
    }
  })

  return elements
}

function QuestionBlock({
  question,
  images,
}: {
  question: Question
  images: Record<string, ImageData>
}) {
  return (
    <View style={styles.question} wrap={false}>
      <Text style={styles.questionNumber}>{question.number}.</Text>

      {renderLines(question.content, images, `q${question.number}`)}

      <View style={styles.optionsBlock}>
        {question.options.map((opt) => (
          <View key={opt.letter} style={styles.option}>
            <Text style={styles.optionLetter}>{opt.letter}.</Text>
            <View style={styles.optionText}>
              {renderLines(opt.content, images, `q${question.number}-${opt.letter}`)}
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

function ExamDocument({
  exam,
  images,
}: {
  exam: ParsedExam
  images: Record<string, ImageData>
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{exam.title}</Text>
        {exam.questions.map((q) => (
          <QuestionBlock key={q.number} question={q} images={images} />
        ))}
      </Page>
    </Document>
  )
}

export async function generatePdf(
  exam: ParsedExam,
  images: Record<string, ImageData>
): Promise<Blob> {
  const blob = await pdf(<ExamDocument exam={exam} images={images} />).toBlob()
  return blob
}
