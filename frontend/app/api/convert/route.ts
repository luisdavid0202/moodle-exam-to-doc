import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.API_URL ?? "http://localhost:8000"

export async function POST(req: NextRequest) {
  const body = await req.formData()

  const res = await fetch(`${BACKEND_URL}/convert`, {
    method: "POST",
    body,
  })

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }))
    return NextResponse.json(detail, { status: res.status })
  }

  const blob = await res.blob()
  const disposition = res.headers.get("content-disposition") ?? ""

  return new NextResponse(blob, {
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": disposition,
    },
  })
}
