"use client"

import { useState } from "react"
import JSZip from "jszip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { parseExamHtml } from "@/lib/parser"
import { generatePdf, ImageData } from "@/lib/pdf-generator"
import { generateDocx } from "@/lib/docx-generator"

type Format = "docx" | "pdf"

export default function Page() {
  const [htmlFile, setHtmlFile] = useState<File | null>(null)
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [format, setFormat] = useState<Format>("pdf")
  const [loading, setLoading] = useState(false)

  function handleHtmlChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setHtmlFile(file)
  }

  function handleZipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setZipFile(file)
  }

  async function handleProcess() {
    if (!htmlFile || !zipFile) return
    setLoading(true)

    try {
      // Parse HTML
      const htmlText = await htmlFile.text()
      const exam = parseExamHtml(htmlText)

      // Extract images from ZIP as base64 data URLs with natural dimensions
      const zip = await JSZip.loadAsync(await zipFile.arrayBuffer())
      const images: Record<string, ImageData> = {}

      await Promise.all(
        Object.entries(zip.files).map(async ([path, file]) => {
          try {
            if (file.dir) return
            const filename = path.split("/").pop()
            // Skip Mac metadata files and non-image files
            if (!filename || filename.startsWith("._")) return
            const ext = filename.split(".").pop()?.toLowerCase()
            if (!["png", "jpg", "jpeg", "gif"].includes(ext ?? "")) return

            const base64 = await file.async("base64")
            const mime = ext === "gif" ? "image/gif" : `image/${ext}`
            const src = `data:${mime};base64,${base64}`

            // Load image in browser to get natural dimensions
            const { width, height } = await new Promise<{ width: number; height: number }>(
              (resolve) => {
                const img = new window.Image()
                img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
                img.onerror = () => resolve({ width: 0, height: 0 })
                img.src = src
              }
            )

            if (width === 0 || height === 0) return
            images[filename] = { src, width, height }
          } catch {
            // skip files that fail to process
          }
        })
      )

      let blob: Blob
      let filename: string

      if (format === "pdf") {
        blob = await generatePdf(exam, images)
        filename = `${exam.title}.pdf`
      } else {
        blob = await generateDocx(exam, images)
        filename = `${exam.title}.docx`
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Error al procesar:", err)
    } finally {
      setLoading(false)
    }
  }

  const canProcess = !!htmlFile && !!zipFile

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex flex-col gap-6 w-full max-w-sm">
        <h1 className="text-lg font-medium">Moodle Exam to Doc</h1>

        {/* HTML input */}
        <label
          htmlFor="html-file"
          className="cursor-pointer rounded-md border border-dashed border-input px-6 py-8 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors min-h-28"
        >
          {htmlFile ? (
            <span className="text-foreground font-medium">{htmlFile.name}</span>
          ) : (
            <>
              <span>Selecciona un archivo <strong>.html</strong></span>
              <span className="text-xs">o haz clic para explorar</span>
            </>
          )}
          <Input
            id="html-file"
            type="file"
            accept=".html"
            className="hidden"
            onChange={handleHtmlChange}
          />
        </label>

        {/* ZIP input */}
        <label
          htmlFor="zip-file"
          className="cursor-pointer rounded-md border border-dashed border-input px-6 py-8 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors min-h-28"
        >
          {zipFile ? (
            <span className="text-foreground font-medium">{zipFile.name}</span>
          ) : (
            <>
              <span>Selecciona el <strong>.zip</strong> de imágenes</span>
              <span className="text-xs">carpeta html_files</span>
            </>
          )}
          <Input
            id="zip-file"
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleZipChange}
          />
        </label>

        {/* Format selector + Process button */}
        <div className="flex gap-2">
          <ToggleGroup
            type="single"
            size="lg"
            value={format}
            onValueChange={(v) => v && setFormat(v as Format)}
            className="border border-input rounded-md h-8"
          >
            <ToggleGroupItem value="pdf">pdf</ToggleGroupItem>
            <ToggleGroupItem value="docx">docx</ToggleGroupItem>
          </ToggleGroup>
          <Button
            size="lg"
            className="flex-1"
            disabled={!canProcess || loading}
            onClick={handleProcess}
          >
            {loading ? "Procesando..." : "Convertir"}
          </Button>
        </div>
      </div>
    </div>
  )
}
