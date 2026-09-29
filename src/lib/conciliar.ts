export type TipoFolio = "factura" | "boleta" | "otro"

export type PagoRendicion = {
  id: string
  fecha: string
  proveedor: string
  descripcion: string
  monto: number
  folio: string
}

export type FilaCartola = {
  clave: string
  fecha: string
  fechaTexto: string
  descripcion: string
  monto: number
}

export type Cartola = {
  filas: FilaCartola[]
  columnaCategoria: number | null
  aviso: string | null
}

export type MotivoEmparejado = "exacta" | "monto" | "manual" | "sin_pago"

export type Emparejado = {
  fila: FilaCartola
  pagoId: string | null
  categoria: string
  folio: string
  obs: string
  motivo: MotivoEmparejado
}

const PREFIJO_BANCO: Record<TipoFolio, string> = {
  factura: "FA",
  boleta: "BOL",
  otro: "",
}

const DIAS_TOLERANCIA = 10

export function folioBanco(documentos: { folio: string; tipo: TipoFolio }[]): string {
  const grupos = new Map<TipoFolio, string[]>()
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

export function parseMonto(texto: string): number | null {
  const compacto = texto.replace(/\s|\u00a0/g, "")
  if (!compacto || !/\d/.test(compacto)) return null
  if (/[a-zA-Z]/.test(compacto.replace(/clp/gi, ""))) return null
  const negativo = compacto.startsWith("-") || /^\(.*\)$/.test(compacto)
  const sinDecimales = compacto.replace(/[.,]0{1,2}$/, "")
  const digitos = sinDecimales.replace(/\D/g, "")
  if (!digitos) return null
  const monto = Number(digitos)
  if (!Number.isSafeInteger(monto)) return null
  return negativo ? -monto : monto
}

export function parseFecha(texto: string): string {
  const limpio = texto.trim()
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(limpio)
  if (iso) return armarFecha(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  const corta = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(limpio)
  if (!corta) return ""
  const year = Number(corta[3]) < 100 ? 2000 + Number(corta[3]) : Number(corta[3])
  const primero = Number(corta[1])
  const segundo = Number(corta[2])
  if (primero > 12 || segundo <= 12) return armarFecha(year, segundo, primero)
  return armarFecha(year, primero, segundo)
}

function armarFecha(year: number, mes: number, dia: number): string {
  if (year < 2000 || year > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return ""
  return `${year}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
}

export function celdas(texto: string, separador: string): string[][] {
  const filas: string[][] = []
  let fila: string[] = []
  let celda = ""
  let entreComillas = false
  for (let indice = 0; indice < texto.length; indice++) {
    const caracter = texto[indice]
    if (entreComillas) {
      if (caracter !== '"') {
        celda += caracter
      } else if (texto[indice + 1] === '"') {
        celda += '"'
        indice++
      } else {
        entreComillas = false
      }
      continue
    }
    if (caracter === '"') {
      entreComillas = true
      continue
    }
    if (caracter === separador) {
      fila.push(celda)
      celda = ""
      continue
    }
    if (caracter === "\r") continue
    if (caracter === "\n") {
      fila.push(celda)
      filas.push(fila)
      fila = []
      celda = ""
      continue
    }
    celda += caracter
  }
  fila.push(celda)
  filas.push(fila)
  return filas.filter((item) => item.some((valor) => valor.trim() !== ""))
}

function sinAcento(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/á/g, "a")
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u")
    .trim()
}

function separadorDe(texto: string): string {
  if (texto.includes("\t")) return "\t"
  if (texto.includes(";")) return ";"
  return ","
}

function indiceMonto(cabecera: string[]): number {
  const exacto = cabecera.findIndex((celda) => celda === "monto")
  if (exacto >= 0) return exacto
  const sinCuota = cabecera.findIndex((celda) => /monto|cargo/.test(celda) && !/cuota/.test(celda))
  if (sinCuota >= 0) return sinCuota
  return cabecera.findIndex((celda) => /monto|valor/.test(celda))
}

export function leerCartola(texto: string): Cartola {
  if (!texto.trim()) return { filas: [], columnaCategoria: null, aviso: null }
  const bruto = celdas(texto, separadorDe(texto))
  const indiceCabecera = bruto.findIndex((fila) => {
    const normal = fila.map(sinAcento)
    return normal.some((celda) => /monto/.test(celda)) && normal.some((celda) => /descrip|detalle|glosa/.test(celda))
  })

  let columnas: { fecha: number; descripcion: number; monto: number }
  let cuerpo: string[][]
  let columnaCategoria: number | null = null
  let aviso: string | null = null

  if (indiceCabecera >= 0) {
    const cabecera = bruto[indiceCabecera].map(sinAcento)
    columnas = {
      fecha: cabecera.findIndex((celda) => /fecha/.test(celda)),
      descripcion: cabecera.findIndex((celda) => /descrip|detalle|glosa/.test(celda)),
      monto: indiceMonto(cabecera),
    }
    const categoria = cabecera.findIndex((celda) => /categor/.test(celda))
    columnaCategoria = categoria >= 0 ? categoria + 1 : null
    cuerpo = bruto.slice(indiceCabecera + 1)
  } else {
    const referencia = bruto[0] ?? []
    const fecha = referencia.findIndex((celda) => parseFecha(celda) !== "")
    const monto = referencia.findIndex((celda, indice) => indice !== fecha && parseMonto(celda) !== null)
    let descripcion = -1
    let letras = 0
    referencia.forEach((celda, indice) => {
      if (indice === fecha || indice === monto) return
      const cuenta = (celda.match(/[a-zA-Z]/g) ?? []).length
      if (cuenta > letras) {
        letras = cuenta
        descripcion = indice
      }
    })
    columnas = { fecha, descripcion, monto }
    cuerpo = bruto
    aviso = "No encontré la fila de títulos. Copia también el encabezado de la planilla para asegurar las columnas."
  }

  if (columnas.monto < 0) {
    return {
      filas: [],
      columnaCategoria,
      aviso: "No encontré la columna del monto. Copia las filas junto con el encabezado de la planilla.",
    }
  }

  const filas: FilaCartola[] = []
  cuerpo.forEach((fila, indice) => {
    const montoTexto = fila[columnas.monto] ?? ""
    const monto = parseMonto(montoTexto)
    if (monto === null || monto === 0) return
    const fechaTexto = (columnas.fecha >= 0 ? fila[columnas.fecha] : "")?.trim() ?? ""
    filas.push({
      clave: `fila-${indice}`,
      fecha: parseFecha(fechaTexto),
      fechaTexto,
      descripcion: (columnas.descripcion >= 0 ? fila[columnas.descripcion] : "")?.trim() ?? "",
      monto,
    })
  })

  return { filas, columnaCategoria, aviso }
}

export function leerRendicion(csv: string): PagoRendicion[] {
  const texto = csv.replace(/^\uFEFF/, "")
  if (!texto.trim()) return []
  const filas = celdas(texto, separadorDe(texto))
  const cabecera = (filas[0] ?? []).map(sinAcento)
  const columna = (nombre: string) => cabecera.indexOf(nombre)
  const indices = {
    id: columna("pago_id"),
    fecha: columna("fecha"),
    proveedor: columna("proveedor"),
    descripcion: columna("descripcion"),
    monto: columna("monto_pago"),
    folioBanco: columna("folio_banco"),
    folio: columna("folio"),
    tipo: columna("tipo"),
  }
  if (indices.fecha < 0 || indices.monto < 0) return []

  const pagos = new Map<string, PagoRendicion>()
  const documentos = new Map<string, { folio: string; tipo: TipoFolio }[]>()

  for (const fila of filas.slice(1)) {
    const valor = (indice: number) => (indice >= 0 ? (fila[indice] ?? "").trim() : "")
    const monto = parseMonto(valor(indices.monto))
    const fecha = parseFecha(valor(indices.fecha))
    if (monto === null || !fecha) continue
    const proveedor = valor(indices.proveedor)
    const clave = valor(indices.id) || `${fecha}|${monto}|${proveedor}`
    if (!pagos.has(clave)) {
      pagos.set(clave, {
        id: clave,
        fecha,
        proveedor,
        descripcion: valor(indices.descripcion),
        monto,
        folio: valor(indices.folioBanco),
      })
      documentos.set(clave, [])
    }
    const folio = valor(indices.folio)
    if (folio) {
      const tipo = valor(indices.tipo)
      documentos.get(clave)?.push({
        folio,
        tipo: tipo === "boleta" ? "boleta" : tipo === "otro" ? "otro" : "factura",
      })
    }
  }

  return [...pagos.values()].map((pago) => ({
    ...pago,
    folio: pago.folio || folioBanco(documentos.get(pago.id) ?? []),
  }))
}

function diasEntre(unaFecha: string, otraFecha: string): number {
  if (!unaFecha || !otraFecha) return Number.POSITIVE_INFINITY
  const una = Date.parse(`${unaFecha}T00:00:00Z`)
  const otra = Date.parse(`${otraFecha}T00:00:00Z`)
  if (Number.isNaN(una) || Number.isNaN(otra)) return Number.POSITIVE_INFINITY
  return Math.abs(una - otra) / 86_400_000
}

function categoriaSugerida(descripcion: string): string {
  return /^(pago|abono)\b/.test(sinAcento(descripcion)) ? "PTC" : ""
}

function fechaCorta(iso: string): string {
  return iso ? iso.split("-").reverse().join("-") : ""
}

export function conciliar(
  filas: FilaCartola[],
  pagos: PagoRendicion[],
  manual: Record<string, string> = {},
): Emparejado[] {
  const porId = new Map(pagos.map((pago) => [pago.id, pago]))
  const usados = new Set<string>()
  const elegido = new Map<string, { pago: PagoRendicion | null; motivo: MotivoEmparejado }>()

  for (const fila of filas) {
    const eleccion = manual[fila.clave]
    if (eleccion === undefined) continue
    const pago = eleccion ? porId.get(eleccion) : undefined
    if (pago && !usados.has(pago.id)) {
      usados.add(pago.id)
      elegido.set(fila.clave, { pago, motivo: "manual" })
    } else {
      elegido.set(fila.clave, { pago: null, motivo: "manual" })
    }
  }

  for (const fila of filas) {
    if (elegido.has(fila.clave)) continue
    const pago = pagos.find(
      (item) => !usados.has(item.id) && item.monto === fila.monto && item.fecha === fila.fecha,
    )
    if (!pago) continue
    usados.add(pago.id)
    elegido.set(fila.clave, { pago, motivo: "exacta" })
  }

  for (const fila of filas) {
    if (elegido.has(fila.clave)) continue
    const candidatos = pagos
      .filter((item) => !usados.has(item.id) && item.monto === fila.monto)
      .sort((una, otra) => diasEntre(una.fecha, fila.fecha) - diasEntre(otra.fecha, fila.fecha))
    const pago = candidatos[0]
    if (!pago || diasEntre(pago.fecha, fila.fecha) > DIAS_TOLERANCIA) continue
    usados.add(pago.id)
    elegido.set(fila.clave, { pago, motivo: "monto" })
  }

  return filas.map((fila) => {
    const par = elegido.get(fila.clave)
    const pago = par?.pago ?? null
    if (!pago) {
      return {
        fila,
        pagoId: null,
        categoria: par?.motivo === "manual" ? "" : categoriaSugerida(fila.descripcion),
        folio: "",
        obs: "",
        motivo: par?.motivo === "manual" ? "manual" : "sin_pago",
      }
    }
    const notas: string[] = []
    if (!pago.folio) notas.push("Pago sin folio en la app")
    if (pago.fecha !== fila.fecha) notas.push(`Fecha en la app: ${fechaCorta(pago.fecha)}`)
    return {
      fila,
      pagoId: pago.id,
      categoria: "RENDICION",
      folio: pago.folio,
      obs: notas.join(" · "),
      motivo: par?.motivo ?? "exacta",
    }
  })
}

export function tsvSalida(emparejados: Emparejado[]): string {
  return emparejados.map((item) => [item.categoria, item.folio, item.obs].join("\t")).join("\n")
}
