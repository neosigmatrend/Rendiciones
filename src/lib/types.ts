export const TIPOS_DOCUMENTO = ["factura", "boleta", "otro"] as const

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]

export type Foto = {
  id: string
  nombre: string
  archivo: string
  tipo: string
}

export type Documento = {
  id: string
  folio: string
  fecha: string
  monto: number
  tipo: TipoDocumento
}

export type Pago = {
  id: string
  fecha: string
  proveedor: string
  descripcion: string
  monto: number
  tarjeta: string
  fotos: Foto[]
  documentos: Documento[]
  ejemplo: boolean
  creadoEn: string
  actualizadoEn: string
}

export type EstadoCuadre = "sin_documentos" | "cuadra" | "falta" | "sobra"

export type Cuadre = {
  suma: number
  diferencia: number
  estado: EstadoCuadre
}
