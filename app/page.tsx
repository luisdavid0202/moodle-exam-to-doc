"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type Format = "docx" | "pdf" | "gdoc"

export default function Page() {
  const [htmlFile, setHtmlFile] = useState<File | null>(null)
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [format, setFormat] = useState<Format>("docx")

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

  function handleProcess() {
    if (!htmlFile || !zipFile) return
    console.log("Procesar", { htmlFile: htmlFile.name, zipFile: zipFile.name, format })
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
            <ToggleGroupItem value="docx">docx</ToggleGroupItem>
            <ToggleGroupItem value="pdf">pdf</ToggleGroupItem>
            <ToggleGroupItem value="gdoc">gdoc</ToggleGroupItem>
          </ToggleGroup>
          <Button size="lg" className="flex-1" disabled={!canProcess} onClick={handleProcess}>
            Convertir
          </Button>
        </div>
      </div>
    </div>
  )
}
