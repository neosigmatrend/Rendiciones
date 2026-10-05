import AsyncStorage from "@react-native-async-storage/async-storage"
import { Directory, File, Paths } from "expo-file-system"
import * as Crypto from "expo-crypto"
import type { Documento, Foto, Pago, TipoDocumento } from "./types"
import { TIPOS_DOCUMENTO } from "./types"

const CLAVE = "rendiciones.pagos.v1"

function pagoEjemplo(
  pago: Omit<Pago, "ejemplo" | "fotos" | "esRendicion" | "creadoEn" | "actualizadoEn"> & { creadoEn: string },
): Pago {
  return { ...pago, esRendicion: true, fotos: [], ejemplo: true, actualizadoEn: pago.creadoEn }
}

export function semilla(): Pago[] {
  return [
    pagoEjemplo({
      id: "ejemplo-agrosuper",
      fecha: "2026-09-21",
      proveedor: "Agrosuper",
      descripcion: "Pago en línea",
      monto: 166547,
      tarjeta: "Visa empresa",
      documentos: [
        { id: "doc-agrosuper-1", folio: "101070510", fecha: "2026-08-22", monto: 53480, tipo: "factura" },
        { id: "doc-agrosuper-2", folio: "101070582", fecha: "2026-08-26", monto: 113067, tipo: "factura" },
      ],
      creadoEn: "2026-09-21T15:00:00.000Z",
    }),
    pagoEjemplo({
      id: "ejemplo-gasco",
      fecha: "2026-09-18",
      proveedor: "Gasco",
      descripcion: "Recarga granel",
      monto: 580179,
      tarjeta: "Mastercard empresa",
      documentos: [
        { id: "doc-gasco-1", folio: "12214585", fecha: "", monto: 405057, tipo: "otro" },
        { id: "doc-gasco-2", folio: "12215855", fecha: "", monto: 175122, tipo: "otro" },
      ],
      creadoEn: "2026-09-18T15:00:00.000Z",
    }),
    pagoEjemplo({
      id: "ejemplo-aguas-andinas",
      fecha: "2026-08-17",
      proveedor: "Aguas Andinas",
      descripcion: "Pago Webpay",
      monto: 211060,
      tarjeta: "Visa empresa",
      documentos: [],
      creadoEn: "2026-08-17T22:58:57.000Z",
    }),
  ]
}

function esTipo(valor: string): valor is TipoDocumento {
  return (TIPOS_DOCUMENTO as readonly string[]).includes(valor)
}

function normalizar(valor: unknown): Pago | null {
  if (!valor || typeof valor !== "object") return null
  const pago = valor as Partial<Pago>
  if (typeof pago.id !== "string" || typeof pago.fecha !== "string") return null
  if (typeof pago.proveedor !== "string" || typeof pago.monto !== "number") return null
  if (typeof pago.tarjeta !== "string") return null

  const documentos = Array.isArray(pago.documentos)
    ? pago.documentos.flatMap((documento) => {
        if (!documento || typeof documento !== "object") return []
        const item = documento as Partial<Documento>
        if (typeof item.id !== "string" || typeof item.folio !== "string") return []
        if (typeof item.monto !== "number" || typeof item.tipo !== "string" || !esTipo(item.tipo)) return []
        return [{ id: item.id, folio: item.folio, fecha: typeof item.fecha === "string" ? item.fecha : "", monto: item.monto, tipo: item.tipo }]
      })
    : []

  const fotos = Array.isArray(pago.fotos)
    ? pago.fotos.flatMap((foto) => {
        if (!foto || typeof foto !== "object") return []
        const item = foto as Partial<Foto>
        if (typeof item.id !== "string" || typeof item.uri !== "string" || typeof item.nombre !== "string") return []
        return [
          {
            id: item.id,
            nombre: item.nombre,
            uri: item.uri,
            texto: typeof item.texto === "string" ? item.texto : undefined,
            apoyo: item.apoyo === true ? true : undefined,
          },
        ]
      })
    : []

  return {
    id: pago.id,
    fecha: pago.fecha,
    proveedor: pago.proveedor,
    descripcion: typeof pago.descripcion === "string" ? pago.descripcion : "",
    monto: pago.monto,
    tarjeta: pago.tarjeta,
    esRendicion: pago.esRendicion !== false,
    fotos,
    documentos,
    ejemplo: pago.ejemplo === true,
    creadoEn: typeof pago.creadoEn === "string" ? pago.creadoEn : new Date().toISOString(),
    actualizadoEn: typeof pago.actualizadoEn === "string" ? pago.actualizadoEn : new Date().toISOString(),
  }
}

function ordenar(pagos: Pago[]) {
  return [...pagos].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1
    return a.creadoEn < b.creadoEn ? 1 : -1
  })
}

async function guardarTodos(pagos: Pago[]) {
  await AsyncStorage.setItem(CLAVE, JSON.stringify(pagos))
}

export async function leerPagos(): Promise<Pago[]> {
  const crudo = await AsyncStorage.getItem(CLAVE)
  if (!crudo) {
    const inicial = semilla()
    await guardarTodos(inicial)
    return inicial
  }
  try {
    const json: unknown = JSON.parse(crudo)
    if (!Array.isArray(json)) return semilla()
    return ordenar(json.flatMap((item) => {
      const pago = normalizar(item)
      return pago ? [pago] : []
    }))
  } catch {
    return semilla()
  }
}

export type PagoInput = {
  fecha: string
  proveedor: string
  descripcion: string
  monto: number
  tarjeta: string
  esRendicion: boolean
  documentos: Omit<Documento, "id">[]
  fotosNuevas: { uri: string; nombre: string; texto?: string; apoyo?: boolean }[]
  fotosConservadas: Foto[]
}

function carpetaCapturas() {
  const carpeta = new Directory(Paths.document, "capturas")
  if (!carpeta.exists) carpeta.create()
  return carpeta
}

function extensionDe(nombre: string) {
  const coincidencia = nombre.toLowerCase().match(/\.([a-z0-9]+)$/)
  const extension = coincidencia?.[1]
  if (extension === "jpeg") return "jpg"
  if (extension && ["jpg", "png", "webp", "gif", "heic", "pdf"].includes(extension)) return extension
  return "jpg"
}

export async function copiarCaptura(uri: string, nombre: string, texto?: string, apoyo?: boolean): Promise<Foto> {
  const carpeta = carpetaCapturas()
  const id = Crypto.randomUUID()
  const archivo = new File(carpeta, `${id}.${extensionDe(nombre || uri)}`)
  await new File(uri).copy(archivo)
  return { id, nombre: nombre || archivo.name, uri: archivo.uri, texto, apoyo: apoyo ? true : undefined }
}

function borrarCaptura(uri: string) {
  try {
    const archivo = new File(uri)
    if (archivo.exists) archivo.delete()
  } catch {
    // La captura ya no está en el teléfono.
  }
}

export async function crearPago(input: PagoInput): Promise<Pago> {
  const fotos = []
  for (const captura of input.fotosNuevas) {
    fotos.push(await copiarCaptura(captura.uri, captura.nombre, captura.texto, captura.apoyo))
  }
  const ahora = new Date().toISOString()
  const pago: Pago = {
    id: Crypto.randomUUID(),
    fecha: input.fecha,
    proveedor: input.proveedor,
    descripcion: input.descripcion,
    monto: input.monto,
    tarjeta: input.tarjeta,
    esRendicion: input.esRendicion,
    fotos,
    documentos: input.documentos.map((documento) => ({ ...documento, id: Crypto.randomUUID() })),
    ejemplo: false,
    creadoEn: ahora,
    actualizadoEn: ahora,
  }
  const pagos = await leerPagos()
  await guardarTodos(ordenar([pago, ...pagos]))
  return pago
}

export async function actualizarPago(id: string, input: PagoInput): Promise<Pago> {
  const pagos = await leerPagos()
  const actual = pagos.find((pago) => pago.id === id)
  if (!actual) throw new Error("Ese pago no está registrado.")
  const conservadas = new Set(input.fotosConservadas.map((foto) => foto.id))
  actual.fotos.filter((foto) => !conservadas.has(foto.id)).forEach((foto) => borrarCaptura(foto.uri))
  const nuevas = []
  for (const captura of input.fotosNuevas) {
    nuevas.push(await copiarCaptura(captura.uri, captura.nombre, captura.texto, captura.apoyo))
  }
  const actualizado: Pago = {
    ...actual,
    fecha: input.fecha,
    proveedor: input.proveedor,
    descripcion: input.descripcion,
    monto: input.monto,
    tarjeta: input.tarjeta,
    esRendicion: input.esRendicion,
    documentos: input.documentos.map((documento) => ({ ...documento, id: Crypto.randomUUID() })),
    fotos: [...input.fotosConservadas, ...nuevas],
    ejemplo: false,
    actualizadoEn: new Date().toISOString(),
  }
  await guardarTodos(ordenar(pagos.map((pago) => (pago.id === id ? actualizado : pago))))
  return actualizado
}

export async function eliminarPago(id: string) {
  const pagos = await leerPagos()
  const pago = pagos.find((item) => item.id === id)
  pago?.fotos.forEach((foto) => borrarCaptura(foto.uri))
  await guardarTodos(pagos.filter((item) => item.id !== id))
}
