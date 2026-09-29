import type { Cuadre, Documento, EstadoCuadre, TipoDocumento } from "./types"

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const MESES_LARGOS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
]

export function parseCLP(value: string): number | null {
  const digits = value.replace(/\D/g, "")
  if (!digits) return null
  const amount = Number(digits)
  if (!Number.isSafeInteger(amount)) return null
  return amount
}

export function formatCLP(amount: number): string {
  const negative = amount < 0
  const digits = Math.abs(Math.round(amount)).toString()
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${negative ? "-" : ""}$${grouped}`
}

export function formatMontoInput(amount: number): string {
  return Math.abs(Math.round(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

function partes(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [year, month, day] = iso.split("-").map(Number)
  if (!year || !month || !day || month < 1 || month > 12) return null
  return { year, month, day }
}

export function formatFecha(iso: string): string {
  const fecha = partes(iso)
  if (!fecha) return iso
  return `${fecha.day} ${MESES[fecha.month - 1]} ${fecha.year}`
}

export function formatFechaLarga(iso: string): string {
  const fecha = partes(iso)
  if (!fecha) return iso
  return `${fecha.day} de ${MESES_LARGOS[fecha.month - 1]} de ${fecha.year}`
}

export function etiquetaMes(mes: string): string {
  if (!/^\d{4}-\d{2}$/.test(mes)) return mes
  const [year, month] = mes.split("-").map(Number)
  if (!year || !month || month < 1 || month > 12) return mes
  const nombre = MESES_LARGOS[month - 1]
  return nombre.charAt(0).toUpperCase() + nombre.slice(1) + " " + year
}

export function mesDeFecha(fecha: string): string {
  return fecha.slice(0, 7)
}

export function isoDeDate(fecha: Date): string {
  const month = String(fecha.getMonth() + 1).padStart(2, "0")
  const day = String(fecha.getDate()).padStart(2, "0")
  return `${fecha.getFullYear()}-${month}-${day}`
}

export function dateDeIso(iso: string): Date {
  const fecha = partes(iso)
  if (!fecha) return new Date()
  return new Date(fecha.year, fecha.month - 1, fecha.day)
}

export function hoyIso(): string {
  return isoDeDate(new Date())
}

const ETIQUETAS_TIPO: Record<TipoDocumento, string> = {
  factura: "Factura",
  boleta: "Boleta",
  otro: "Otro",
}

export function etiquetaTipo(tipo: TipoDocumento): string {
  return ETIQUETAS_TIPO[tipo]
}

const PREFIJO_BANCO: Record<TipoDocumento, string> = {
  factura: "FA",
  boleta: "BOL",
  otro: "",
}

export function folioBanco(documentos: Pick<Documento, "folio" | "tipo">[]): string {
  const grupos = new Map<TipoDocumento, string[]>()
  for (const documento of documentos) {
    const folio = documento.folio.trim()
    if (!folio) continue
    const folios = grupos.get(documento.tipo) ?? []
    if (!folios.includes(folio)) folios.push(folio)
    grupos.set(documento.tipo, folios)
  }
  const partes: string[] = []
  for (const tipo of ["factura", "boleta", "otro"] as const) {
    const folios = grupos.get(tipo)
    if (!folios || folios.length === 0) continue
    const unidos = folios.join("-")
    partes.push(PREFIJO_BANCO[tipo] ? `${PREFIJO_BANCO[tipo]} ${unidos}` : unidos)
  }
  return partes.join(" ")
}

export function cuadreDe(monto: number, documentos: Pick<Documento, "folio" | "monto">[]): Cuadre {
  const suma = documentos.reduce((total, documento) => total + documento.monto, 0)
  const conDatos = documentos.some((documento) => documento.folio.trim() || documento.monto > 0)
  const diferencia = monto - suma
  let estado: EstadoCuadre
  if (!conDatos) estado = "sin_documentos"
  else if (diferencia === 0) estado = "cuadra"
  else if (diferencia > 0) estado = "falta"
  else estado = "sobra"
  return { suma, diferencia, estado }
}

export function etiquetaCuadre(cuadre: Cuadre): string {
  if (cuadre.estado === "cuadra") return "Cuadra"
  if (cuadre.estado === "sin_documentos") return "Sin documentos"
  if (cuadre.estado === "falta") return `Faltan ${formatCLP(cuadre.diferencia)}`
  return `Sobran ${formatCLP(Math.abs(cuadre.diferencia))}`
}
