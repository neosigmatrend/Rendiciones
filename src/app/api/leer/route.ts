import { leerTexto } from "@/lib/leerDocumento"
import sharp from "sharp"

export const runtime = "nodejs"

const OCR_URL = "https://api.ocr.space/parse/image"
const OCR_KEY = "helloworld"

type RespuestaOcr = {
  ErrorMessage?: string | string[] | null
  ParsedResults?: { ParsedText?: string; ErrorMessage?: string }[]
}

function mensajeError(error: RespuestaOcr["ErrorMessage"]) {
  if (Array.isArray(error)) return error.filter(Boolean).join(" ")
  return error ?? ""
}

async function jpegDe(bytes: Buffer) {
  let imagen = await sharp(bytes).rotate().resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 60 }).toBuffer()
  if (imagen.length > 900_000) {
    imagen = await sharp(imagen).resize({ width: 1000 }).jpeg({ quality: 40 }).toBuffer()
  }
  return imagen
}

async function pedirTexto(jpeg: Buffer, motor: "1" | "2") {
  const cuerpo = new FormData()
  cuerpo.append("file", new File([new Uint8Array(jpeg)], "captura.jpg", { type: "image/jpeg" }))
  cuerpo.append("language", "spa")
  cuerpo.append("isOverlayRequired", "false")
  cuerpo.append("OCREngine", motor)
  cuerpo.append("scale", "true")
  cuerpo.append("detectOrientation", "true")

  const respuesta = await fetch(OCR_URL, {
    method: "POST",
    headers: { apikey: OCR_KEY },
    body: cuerpo,
    signal: AbortSignal.timeout(30_000),
  })
  if (!respuesta.ok) return ""
  const datos = (await respuesta.json()) as RespuestaOcr
  const texto = (datos.ParsedResults ?? [])
    .map((resultado) => resultado.ParsedText ?? "")
    .join("\n")
    .trim()
  if (texto) return texto
  const error = `${mensajeError(datos.ErrorMessage)} ${(datos.ParsedResults ?? []).map((resultado) => resultado.ErrorMessage ?? "").join(" ")}`
  if (motor === "2" && error.trim()) return ""
  return ""
}

export async function POST(request: Request) {
  try {
    const formulario = await request.formData()
    const foto = formulario.get("foto")
    if (!(foto instanceof File) || foto.size === 0) {
      return Response.json({ ok: false, motivo: "servicio" }, { status: 400 })
    }
    const jpeg = await jpegDe(Buffer.from(await foto.arrayBuffer()))
    let texto = await pedirTexto(jpeg, "1")
    if (!texto) texto = await pedirTexto(jpeg, "2")
    if (!texto) return Response.json({ ok: false, motivo: "servicio" })
    const lectura = leerTexto(texto)
    if (lectura.monto == null && lectura.documentos.length === 0) {
      return Response.json({ ok: false, motivo: "sin_datos" })
    }
    return Response.json({ ok: true, lectura })
  } catch {
    return Response.json({ ok: false, motivo: "sin_red" })
  }
}
