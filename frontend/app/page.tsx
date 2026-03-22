"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const API_URL = "http://localhost:8000"

export default function Page() {
  const [htmlFile, setHtmlFile] = useState<File | null>(null)
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleHtmlChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setHtmlFile(file)
    setError(null)
  }

  function handleZipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setZipFile(file)
    setError(null)
  }

  async function handleProcess() {
    if (!htmlFile || !zipFile) return
    setLoading(true)
    setError(null)

    try {
      const body = new FormData()
      body.append("html_file", htmlFile)
      body.append("zip_file", zipFile)
      body.append("format", "docx")

      const res = await fetch(`${API_URL}/convert`, { method: "POST", body })

      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(detail.detail ?? res.statusText)
      }

      const blob = await res.blob()
      const disposition = res.headers.get("content-disposition") ?? ""
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? "exam.docx"

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
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
              <span>Select an <strong>.html</strong> file</span>
              <span className="text-xs">or click to browse</span>
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
              <span>Select the images <strong>.zip</strong></span>
              <span className="text-xs">html_files folder</span>
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

        <Button
          size="lg"
          className="w-full"
          disabled={!canProcess || loading}
          onClick={handleProcess}
        >
          {loading ? "Processing..." : "Convert to document"}
        </Button>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  )
}
