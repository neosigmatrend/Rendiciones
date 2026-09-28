import { File } from "expo-file-system"
import { ImageManipulator, SaveFormat } from "expo-image-manipulator"
import { leerTexto, type Lectura } from "./leerDocumento"

const OCR_URL = "https://api.ocr.space/parse/image"
const OCR_KEY = "helloworld"

export type ResultadoFoto =
  | { ok: true; lectura: Lectura }
  | { ok: false; motivo: "sin_datos" | "sin_red" | "servicio" }

type RespuestaOcr = {
  IsErroredOnProcessing?: boolean
  ErrorMessage?: string | string[] | null
  ParsedResults?: { ParsedText?: string }[]
}

function mensajeError(error: RespuestaOcr["ErrorMessage"]): string {
  if (Array.isArray(error)) return error.join(" ")
  return error ?? ""
}

async function jpegBase64(uri: string, ancho: number | undefined, tope: number, calidad: number): Promise<string | null> {
  const contexto = ImageManipulator.manipulate(uri)
  if (!ancho || ancho > tope) contexto.resize({ width: tope })
  const imagen = await contexto.renderAsync()
  const resultado = await imagen.saveAsync({
    compress: calidad,
    format: SaveFormat.JPEG,
    base64: true,
  })
  return resultado.base64 ?? null
}

async function base64DeFoto(uri: string, ancho: number | undefined): Promise<string | null> {
  try {
    let base64 = await jpegBase64(uri, ancho, 1400, 0.6)
    if (base64 && base64.length > 1_000_000) base64 = await jpegBase64(uri, ancho, 1000, 0.4)
    if (base64) return base64
  } catch {
    /* la foto original puede servir si ya es liviana */
  }
  try {
    const archivo = new File(uri)
    if (!archivo.exists || archivo.size > 900_000) return null
    return archivo.base64Sync()
  } catch {
    return null
  }
}

async function pedirTexto(base64: string, motor: "1" | "2"): Promise<{ texto: string; error: string }> {
  const cuerpo = new FormData()
  cuerpo.append("base64Image", `data:image/jpeg;base64,${base64}`)
  cuerpo.append("language", "spa")
  cuerpo.append("isOverlayRequired", "false")
  cuerpo.append("OCREngine", motor)
  cuerpo.append("scale", "true")
  cuerpo.append("detectOrientation", "true")
  cuerpo.append("filetype", "JPG")

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
    return { texto, error: mensajeError(datos.ErrorMessage) }
  } finally {
    clearTimeout(plazo)
  }
}

async function textoDeFoto(base64: string): Promise<string> {
  const primero = await pedirTexto(base64, "2")
  if (primero.texto) return primero.texto
  if (/engine/i.test(primero.error)) {
    const segundo = await pedirTexto(base64, "1")
    return segundo.texto
  }
  return ""
}

export async function leerFoto(uri: string, ancho?: number): Promise<ResultadoFoto> {
  try {
    const base64 = await base64DeFoto(uri, ancho)
    if (!base64) return { ok: false, motivo: "servicio" }
    const texto = await textoDeFoto(base64)
    if (!texto) return { ok: false, motivo: "servicio" }
    const lectura = leerTexto(texto)
    if (lectura.monto == null && lectura.documentos.length === 0) return { ok: false, motivo: "sin_datos" }
    return { ok: true, lectura }
  } catch (error) {
    const nombre = error instanceof Error ? error.name : ""
    if (nombre === "AbortError" || nombre === "TypeError") return { ok: false, motivo: "sin_red" }
    return { ok: false, motivo: "servicio" }
  }
}
