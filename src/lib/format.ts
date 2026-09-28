import type { Cuadre, Documento, EstadoCuadre, TipoDocumento } from "@/lib/types"

export function parseCLP(value: string): number | null {
  const digits = value.replace(/\D/g, "")
  if (!digits) return null
  const amount = Number(digits)
  if (!Number.isSafeInteger(amount)) return null
  return amount
}

export function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatMontoInput(amount: number): string {
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(amount)
}

export function formatFecha(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const [year, month, day] = iso.split("-").map(Number)
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day))
}

export function formatFechaLarga(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const [year, month, day] = iso.split("-").map(Number)
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day))
}

export function etiquetaMes(mes: string): string {
  if (!/^\d{4}-\d{2}$/.test(mes)) return mes
  const [year, month] = mes.split("-").map(Number)
  const label = new Intl.DateTimeFormat("es-CL", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function mesDeFecha(fecha: string): string {
  return fecha.slice(0, 7)
}

const ETIQUETAS_TIPO: Record<TipoDocumento, string> = {
  factura: "Factura",
  boleta: "Boleta",
  otro: "Otro",
}

export function etiquetaTipo(tipo: TipoDocumento): string {
  return ETIQUETAS_TIPO[tipo]
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
