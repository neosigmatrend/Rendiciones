import { randomUUID } from "crypto"
import { mkdir, readFile, rename, rm, writeFile } from "fs/promises"
import path from "path"
import type { Documento, Foto, Pago, TipoDocumento } from "@/lib/types"
import { TIPOS_DOCUMENTO } from "@/lib/types"

const DATA_DIR = path.join(process.cwd(), "data")
const PAGOS_PATH = path.join(DATA_DIR, "pagos.json")
const FOTOS_DIR = path.join(DATA_DIR, "fotos")

const TIPOS_FOTO = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
])

const MAX_FOTO_BYTES = 8 * 1024 * 1024
const MAX_FOTOS = 8

let queue: Promise<unknown> = Promise.resolve()

function enCola<T>(tarea: () => Promise<T>): Promise<T> {
  const ejecucion = queue.then(tarea, tarea)
  queue = ejecucion.then(
    () => undefined,
    () => undefined,
  )
  return ejecucion
}

function pagoEjemplo(
  pago: Omit<Pago, "ejemplo" | "fotos" | "creadoEn" | "actualizadoEn"> & {
    creadoEn: string
  },
): Pago {
  return {
    ...pago,
    fotos: [],
    ejemplo: true,
    actualizadoEn: pago.creadoEn,
  }
}

function semilla(): Pago[] {
  return [
    pagoEjemplo({
      id: "ejemplo-agrosuper",
      fecha: "2026-09-21",
      proveedor: "Agrosuper",
      descripcion: "Pago en línea",
      monto: 166547,
      tarjeta: "Visa empresa",
      documentos: [
        {
          id: "doc-agrosuper-1",
          folio: "101070510",
          fecha: "2026-08-22",
          monto: 53480,
          tipo: "factura",
        },
        {
          id: "doc-agrosuper-2",
          folio: "101070582",
          fecha: "2026-08-26",
          monto: 113067,
          tipo: "factura",
        },
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
        {
          id: "doc-gasco-1",
          folio: "12214585",
          fecha: "",
          monto: 405057,
          tipo: "otro",
        },
        {
          id: "doc-gasco-2",
          folio: "12215855",
          fecha: "",
          monto: 175122,
          tipo: "otro",
        },
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

function esTipoDocumento(valor: string): valor is TipoDocumento {
  return (TIPOS_DOCUMENTO as readonly string[]).includes(valor)
}

function normalizarPago(valor: unknown): Pago | null {
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
        if (typeof item.monto !== "number" || typeof item.tipo !== "string") return []
        if (!esTipoDocumento(item.tipo)) return []
        return [
          {
            id: item.id,
            folio: item.folio,
            fecha: typeof item.fecha === "string" ? item.fecha : "",
            monto: item.monto,
            tipo: item.tipo,
          },
        ]
      })
    : []
  const fotos = Array.isArray(pago.fotos)
    ? pago.fotos.flatMap((foto) => {
        if (!foto || typeof foto !== "object") return []
        const item = foto as Partial<Foto>
        if (typeof item.id !== "string" || typeof item.archivo !== "string") return []
        if (typeof item.nombre !== "string" || typeof item.tipo !== "string") return []
        return [
          {
            id: item.id,
            nombre: item.nombre,
            archivo: path.basename(item.archivo),
            tipo: item.tipo,
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
    fotos,
    documentos,
    ejemplo: pago.ejemplo === true,
    creadoEn: typeof pago.creadoEn === "string" ? pago.creadoEn : new Date().toISOString(),
    actualizadoEn:
      typeof pago.actualizadoEn === "string" ? pago.actualizadoEn : new Date().toISOString(),
  }
}

async function asegurarDirectorios() {
  await mkdir(FOTOS_DIR, { recursive: true })
}

async function leerArchivo(): Promise<Pago[]> {
  await asegurarDirectorios()
  try {
    const contenido = await readFile(PAGOS_PATH, "utf8")
    const json: unknown = JSON.parse(contenido)
    if (!Array.isArray(json)) return semilla()
    return json.flatMap((item) => {
      const pago = normalizarPago(item)
      return pago ? [pago] : []
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const pagos = semilla()
      await escribirArchivo(pagos)
      return pagos
    }
    throw error
  }
}

async function escribirArchivo(pagos: Pago[]) {
  await asegurarDirectorios()
  const temporal = `${PAGOS_PATH}.tmp`
  await writeFile(temporal, JSON.stringify(pagos, null, 2))
  await rename(temporal, PAGOS_PATH)
}

function ordenar(pagos: Pago[]) {
  return [...pagos].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1
    return a.creadoEn < b.creadoEn ? 1 : -1
  })
}

export async function listarPagos(): Promise<Pago[]> {
  return enCola(async () => ordenar(await leerArchivo()))
}

export async function obtenerPago(id: string): Promise<Pago | null> {
  const pagos = await listarPagos()
  return pagos.find((pago) => pago.id === id) ?? null
}

export type PagoInput = {
  fecha: string
  proveedor: string
  descripcion: string
  monto: number
  tarjeta: string
  documentos: Omit<Documento, "id">[]
  fotosNuevas: File[]
}

async function guardarFotos(archivos: File[]): Promise<Foto[]> {
  const fotos: Foto[] = []
  for (const archivo of archivos) {
    const extension = TIPOS_FOTO.get(archivo.type)
    if (!extension) {
      throw new Error("La captura tiene que ser JPG, PNG, WebP o GIF.")
    }
    if (archivo.size > MAX_FOTO_BYTES) {
      throw new Error("Cada captura puede pesar hasta 8 MB.")
    }
    const id = randomUUID()
    const nombreArchivo = `${id}${extension}`
    const buffer = Buffer.from(await archivo.arrayBuffer())
    await writeFile(path.join(FOTOS_DIR, nombreArchivo), buffer)
    fotos.push({
      id,
      nombre: archivo.name || nombreArchivo,
      archivo: nombreArchivo,
      tipo: archivo.type,
    })
  }
  return fotos
}

export async function crearPago(input: PagoInput): Promise<Pago> {
  return enCola(async () => {
    if (input.fotosNuevas.length > MAX_FOTOS) {
      throw new Error("Puedes adjuntar hasta 8 capturas por pago.")
    }
    const ahora = new Date().toISOString()
    const fotos = await guardarFotos(input.fotosNuevas)
    const pago: Pago = {
      id: randomUUID(),
      fecha: input.fecha,
      proveedor: input.proveedor,
      descripcion: input.descripcion,
      monto: input.monto,
      tarjeta: input.tarjeta,
      fotos,
      documentos: input.documentos.map((documento) => ({ ...documento, id: randomUUID() })),
      ejemplo: false,
      creadoEn: ahora,
      actualizadoEn: ahora,
    }
    const pagos = await leerArchivo()
    await escribirArchivo([pago, ...pagos])
    return pago
  })
}

export async function actualizarPago(id: string, input: PagoInput): Promise<Pago> {
  return enCola(async () => {
    const pagos = await leerArchivo()
    const actual = pagos.find((pago) => pago.id === id)
    if (!actual) throw new Error("Ese pago no está registrado.")
    if (actual.fotos.length + input.fotosNuevas.length > MAX_FOTOS) {
      throw new Error("Puedes adjuntar hasta 8 capturas por pago.")
    }
    const fotosNuevas = await guardarFotos(input.fotosNuevas)
    const actualizado: Pago = {
      ...actual,
      fecha: input.fecha,
      proveedor: input.proveedor,
      descripcion: input.descripcion,
      monto: input.monto,
      tarjeta: input.tarjeta,
      documentos: input.documentos.map((documento) => ({ ...documento, id: randomUUID() })),
      fotos: [...actual.fotos, ...fotosNuevas],
      ejemplo: false,
      actualizadoEn: new Date().toISOString(),
    }
    await escribirArchivo(pagos.map((pago) => (pago.id === id ? actualizado : pago)))
    return actualizado
  })
}

async function borrarArchivoFoto(foto: Foto) {
  await rm(path.join(FOTOS_DIR, path.basename(foto.archivo)), { force: true })
}

export async function eliminarPago(id: string) {
  await enCola(async () => {
    const pagos = await leerArchivo()
    const pago = pagos.find((item) => item.id === id)
    if (!pago) return
    await Promise.all(pago.fotos.map((foto) => borrarArchivoFoto(foto)))
    await escribirArchivo(pagos.filter((item) => item.id !== id))
  })
}

export async function quitarFoto(pagoId: string, fotoId: string) {
  await enCola(async () => {
    const pagos = await leerArchivo()
    const pago = pagos.find((item) => item.id === pagoId)
    if (!pago) return
    const foto = pago.fotos.find((item) => item.id === fotoId)
    if (!foto) return
    await borrarArchivoFoto(foto)
    const actualizado: Pago = {
      ...pago,
      fotos: pago.fotos.filter((item) => item.id !== fotoId),
      actualizadoEn: new Date().toISOString(),
    }
    await escribirArchivo(pagos.map((item) => (item.id === pagoId ? actualizado : item)))
  })
}

export async function leerFoto(
  id: string,
): Promise<{ buffer: Buffer; tipo: string; nombre: string } | null> {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) return null
  const pagos = await listarPagos()
  for (const pago of pagos) {
    const foto = pago.fotos.find((item) => item.id === id)
    if (!foto) continue
    try {
      const buffer = await readFile(path.join(FOTOS_DIR, path.basename(foto.archivo)))
      return { buffer, tipo: foto.tipo, nombre: foto.nombre }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
      throw error
    }
  }
  return null
}
