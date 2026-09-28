import { File } from "expo-file-system"
import { manipulateAsync, SaveFormat } from "expo-image-manipulator"
import { leerTexto, type Lectura } from "./leerDocumento"

const OCR_URL = "https://api.ocr.space/parse/image"
const OCR_KEY = "helloworld"

export type ResultadoFoto =
  | { ok: true; lectura: Lectura }
  | { ok: false; motivo: "sin_datos" | "sin_red" | "servicio" }

type RespuestaOcr = {
  IsErroredOnProcessing?: boolean
  ErrorMessage?: string | string[] | null
  ParsedResults?: { ParsedText?: string; ErrorMessage?: string }[]
}

function mensajeError(error: RespuestaOcr["ErrorMessage"]): string {
  if (Array.isArray(error)) return error.filter(Boolean).join(" ")
  return error ?? ""
}

async function jpegParaLeer(uri: string, ancho: number | undefined): Promise<string | null> {
  const intentos = [
    { tope: 1400, calidad: 0.6 },
    { tope: 1000, calidad: 0.4 },
  ]
  let origen = uri
  let anchoOrigen = ancho
  for (const intento of intentos) {
    const acciones = !anchoOrigen || anchoOrigen > intento.tope ? [{ resize: { width: intento.tope } }] : []
    const imagen = await manipulateAsync(origen, acciones, {
      compress: intento.calidad,
      format: SaveFormat.JPEG,
    })
    origen = imagen.uri
    anchoOrigen = imagen.width
    const archivo = new File(imagen.uri)
    if (archivo.exists && archivo.size > 0 && archivo.size <= 900_000) return imagen.uri
  }
  return null
}

async function pedirTexto(uri: string, motor: "1" | "2"): Promise<{ texto: string; error: string }> {
  const cuerpo = new FormData()
  cuerpo.append("file", { uri, name: "captura.jpg", type: "image/jpeg" } as unknown as Blob)
  cuerpo.append("language", "spa")
  cuerpo.append("isOverlayRequired", "false")
  cuerpo.append("OCREngine", motor)
  cuerpo.append("scale", "true")
  cuerpo.append("detectOrientation", "true")

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

export async function leerFoto(uri: string, ancho?: number): Promise<ResultadoFoto> {
  try {
    const jpeg = await jpegParaLeer(uri, ancho)
    if (!jpeg) return { ok: false, motivo: "servicio" }
    let leido = await pedirTexto(jpeg, "2")
    if (!leido.texto) leido = await pedirTexto(jpeg, "1")
    if (!leido.texto) return { ok: false, motivo: "servicio" }
    const lectura = leerTexto(leido.texto)
    if (lectura.monto == null && lectura.documentos.length === 0) return { ok: false, motivo: "sin_datos" }
    return { ok: true, lectura }
  } catch (error) {
    const nombre = error instanceof Error ? error.name : ""
    if (nombre === "AbortError" || nombre === "TypeError") return { ok: false, motivo: "sin_red" }
    return { ok: false, motivo: "servicio" }
  }
}
