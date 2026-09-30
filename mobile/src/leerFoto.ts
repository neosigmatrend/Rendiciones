import { manipulateAsync, SaveFormat } from "expo-image-manipulator"
import { File } from "expo-file-system"
import { leerTexto, type Lectura } from "./leerDocumento"

const OCR_URL = "https://api.ocr.space/parse/image"
const OCR_KEY = process.env.EXPO_PUBLIC_OCR_KEY ?? ""

export type ResultadoFoto =
  | { ok: true; lectura: Lectura; texto: string }
  | { ok: false; motivo: "sin_datos" | "sin_red" | "servicio"; texto: string }

type RespuestaOcr = {
  IsErroredOnProcessing?: boolean
  ErrorMessage?: string | string[] | null
  ParsedResults?: { ParsedText?: string; ErrorMessage?: string }[]
}

function mensajeError(error: RespuestaOcr["ErrorMessage"]): string {
  if (Array.isArray(error)) return error.filter(Boolean).join(" ")
  return error ?? ""
}

async function jpegBase64(uri: string, ancho: number | undefined): Promise<string | null> {
  const grande = !ancho || ancho > 1400 ? [{ resize: { width: 1400 } }] : []
  const imagen = await manipulateAsync(uri, grande, { compress: 0.55, format: SaveFormat.JPEG, base64: true })
  if (imagen.base64 && imagen.base64.length <= 1_000_000) return imagen.base64
  const menor = await manipulateAsync(uri, [{ resize: { width: 1000 } }], {
    compress: 0.4,
    format: SaveFormat.JPEG,
    base64: true,
  })
  return menor.base64 ?? imagen.base64 ?? null
}

async function pedirTexto(
  base64: string,
  motor: "1" | "2",
  mime: "image/jpeg" | "application/pdf",
  filetype: "JPG" | "PDF",
): Promise<{ texto: string; error: string }> {
  const cuerpo = new FormData()
  cuerpo.append("base64Image", `data:${mime};base64,${base64}`)
  cuerpo.append("language", "spa")
  cuerpo.append("isOverlayRequired", "false")
  cuerpo.append("OCREngine", motor)
  cuerpo.append("scale", "true")
  cuerpo.append("detectOrientation", "true")
  cuerpo.append("filetype", filetype)

  const control = new AbortController()
  const plazo = setTimeout(() => control.abort(), 30_000)
  try {
    const respuesta = await fetch(OCR_URL, {
      method: "POST",
      headers: { apikey: OCR_KEY },
      body: cuerpo,
      signal: control.signal,
    })
    if (!respuesta.ok) return { texto: "", error: `HTTP ${respuesta.status}` }
    const datos = (await respuesta.json()) as RespuestaOcr
    const texto = (datos.ParsedResults ?? [])
      .map((resultado) => resultado.ParsedText ?? "")
      .join("\n")
      .trim()
    const errorLinea = (datos.ParsedResults ?? [])
      .map((resultado) => resultado.ErrorMessage ?? "")
      .join(" ")
    return { texto, error: `${mensajeError(datos.ErrorMessage)} ${errorLinea}`.trim() }
  } finally {
    clearTimeout(plazo)
  }
}

function interpretar(texto: string): ResultadoFoto {
  const lectura = leerTexto(texto)
  const hayCandidatos = lectura.montosCandidatos.length > 0 || lectura.foliosCandidatos.length > 0
  if (lectura.monto == null && lectura.documentos.length === 0 && !hayCandidatos) {
    return { ok: false, motivo: "sin_datos", texto }
  }
  return { ok: true, lectura, texto }
}

function falla(error: unknown, texto: string): ResultadoFoto {
  const nombre = error instanceof Error ? error.name : ""
  if (nombre === "AbortError" || nombre === "TypeError") return { ok: false, motivo: "sin_red", texto }
  return { ok: false, motivo: "servicio", texto }
}

export async function leerFoto(uri: string, ancho?: number): Promise<ResultadoFoto> {
  try {
    const jpeg = await jpegBase64(uri, ancho)
    if (!jpeg) return { ok: false, motivo: "servicio", texto: "" }
    let leido = await pedirTexto(jpeg, "1", "image/jpeg", "JPG")
    if (!leido.texto) leido = await pedirTexto(jpeg, "2", "image/jpeg", "JPG")
    if (!leido.texto) return { ok: false, motivo: "servicio", texto: leido.error }
    return interpretar(leido.texto)
  } catch (error) {
    return falla(error, "")
  }
}

export async function leerPdf(uri: string): Promise<ResultadoFoto> {
  try {
    const archivo = new File(uri)
    const base64 = await archivo.base64()
    if (!base64) return { ok: false, motivo: "servicio", texto: "" }
    if (base64.length > 1_000_000) {
      return { ok: false, motivo: "servicio", texto: "El PDF pesa más de 1 MB y OCR.space no lo acepta." }
    }
    let leido = await pedirTexto(base64, "1", "application/pdf", "PDF")
    if (!leido.texto) leido = await pedirTexto(base64, "2", "application/pdf", "PDF")
    if (!leido.texto) return { ok: false, motivo: "servicio", texto: leido.error }
    return interpretar(leido.texto)
  } catch (error) {
    return falla(error, "")
  }
}
