"use server"

import { revalidatePath } from "next/cache"
import { redirect, unstable_rethrow } from "next/navigation"
import { parseCLP } from "@/lib/format"
import {
  actualizarPago,
  crearPago,
  eliminarPago as borrarPago,
  quitarFoto as removerFoto,
} from "@/lib/store"
import { TIPOS_DOCUMENTO, type TipoDocumento } from "@/lib/types"

export type FormState = {
  error?: string
  fieldErrors?: Partial<
    Record<"fecha" | "proveedor" | "descripcion" | "monto" | "tarjeta" | "documentos" | "fotos", string>
  >
}

function texto(formData: FormData, campo: string) {
  const valor = formData.get(campo)
  return typeof valor === "string" ? valor.trim() : ""
}

function esTipoDocumento(valor: string): valor is TipoDocumento {
  return (TIPOS_DOCUMENTO as readonly string[]).includes(valor)
}

function campoTexto(valor: FormDataEntryValue | undefined) {
  return typeof valor === "string" ? valor.trim() : ""
}

function leerDocumentos(formData: FormData): {
  documentos: { folio: string; fecha: string; monto: number; tipo: TipoDocumento }[]
  error?: string
} {
  const folios = formData.getAll("doc-folio")
  const fechas = formData.getAll("doc-fecha")
  const montos = formData.getAll("doc-monto")
  const tipos = formData.getAll("doc-tipo")
  const documentos: { folio: string; fecha: string; monto: number; tipo: TipoDocumento }[] = []

  for (let index = 0; index < folios.length; index += 1) {
    const folio = campoTexto(folios[index])
    const fecha = campoTexto(fechas[index])
    const monto = parseCLP(campoTexto(montos[index])) ?? 0
    const tipoTexto = campoTexto(tipos[index]) || "factura"
    if (!folio && monto === 0 && !fecha) continue
    if (!esTipoDocumento(tipoTexto)) {
      return { error: "El tipo de documento no es válido.", documentos: [] }
    }
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return { error: "Revisa la fecha de un documento.", documentos: [] }
    }
    documentos.push({ folio, fecha, monto, tipo: tipoTexto })
  }

  return { documentos }
}

function leerFotos(formData: FormData) {
  return formData.getAll("fotos").filter((item): item is File => item instanceof File && item.size > 0)
}

export async function guardarPago(_estado: FormState, formData: FormData): Promise<FormState> {
  const id = texto(formData, "id")
  const fecha = texto(formData, "fecha")
  const proveedor = texto(formData, "proveedor")
  const descripcion = texto(formData, "descripcion")
  const tarjeta = texto(formData, "tarjeta")
  const monto = parseCLP(texto(formData, "monto"))
  const fieldErrors: FormState["fieldErrors"] = {}

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) fieldErrors.fecha = "Indica la fecha del pago."
  if (!proveedor) fieldErrors.proveedor = "Indica el proveedor."
  else if (proveedor.length > 80) fieldErrors.proveedor = "Usa un nombre más corto."
  if (monto == null || monto <= 0) fieldErrors.monto = "Indica el monto del cargo en la tarjeta."
  if (!tarjeta) fieldErrors.tarjeta = "Indica con qué tarjeta pagaste."
  else if (tarjeta.length > 40) fieldErrors.tarjeta = "Usa un nombre más corto."
  if (descripcion.length > 240) fieldErrors.descripcion = "La descripción es demasiado larga."

  const documentos = leerDocumentos(formData)
  if (documentos.error) fieldErrors.documentos = documentos.error

  const fotos = leerFotos(formData)
  if (fotos.some((foto) => !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(foto.type))) {
    fieldErrors.fotos = "La captura tiene que ser JPG, PNG, WebP o GIF."
  } else if (fotos.some((foto) => foto.size > 8 * 1024 * 1024)) {
    fieldErrors.fotos = "Cada captura puede pesar hasta 8 MB."
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const input = {
    fecha,
    proveedor,
    descripcion,
    monto: monto as number,
    tarjeta,
    documentos: documentos.documentos,
    fotosNuevas: fotos,
  }

  try {
    const pago = id ? await actualizarPago(id, input) : await crearPago(input)
    revalidatePath("/")
    revalidatePath(`/pagos/${pago.id}`)
    redirect(`/pagos/${pago.id}`)
  } catch (error) {
    unstable_rethrow(error)
    const message = error instanceof Error ? error.message : "No se pudo guardar el pago."
    return { error: message }
  }
}

export async function eliminarPagoAction(id: string) {
  await borrarPago(id)
  revalidatePath("/")
  redirect("/")
}

export async function quitarFotoAction(formData: FormData) {
  const pagoId = texto(formData, "pagoId")
  const fotoId = texto(formData, "fotoId")
  if (!pagoId || !fotoId) return
  await removerFoto(pagoId, fotoId)
  revalidatePath("/")
  revalidatePath(`/pagos/${pagoId}`)
  revalidatePath(`/pagos/${pagoId}/editar`)
}
