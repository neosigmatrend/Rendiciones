import type { TipoDocumento } from "./types"

export type DocumentoLeido = {
  folio: string
  monto: number
  fecha: string
  tipo: TipoDocumento
}

export type Lectura = {
  monto: number | null
  documentos: DocumentoLeido[]
  proveedor: string | null
  fecha: string | null
}

const MESES: Record<string, number> = {
  ene: 1,
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  set: 9,
  sept: 9,
  septiembre: 9,
  setiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
}

const FOLIO_RE =
  /(?:#\s*|(?:^|[^A-Za-zÁÉÍÓÚáéíóúÑñ])(?:folio\s*:?\s*(?:n[°ºo0*.]{0,3}\s*:?\s*)?|(?:factura|boleta|documento|doc\.?)\s*(?:n[°ºo0*.]{0,3}\s*:?\s*)?))(\d{5,12}|\d{1,3}(?:[.,]\d{3}){1,3})(?!\d)/gi

const FOLIO_LINEA_RE =
  /(?:^|\n)\s*n[°ºo]\.?\s*:?\s*(\d{5,12}|\d{1,3}(?:[.,]\d{3}){1,3})(?!\d)/gi

const MONTO_RE =
  /\$\s*\d{1,3}(?:\s*[.,]\s*\d{3})+(?:\s*clp)?(?!\d)|\$\s*\d{1,3}(?:[ \u00a0]\d{3})+(?!\d)|\$\s*\d{4,9}(?!\d)|(?<![#\d])\d{1,3}(?:\s*[.,]\s*\d{3})+(?:\s*clp)?(?!\d)|(?<![#\d])\d{4,9}\s*clp(?!\d)|clp\s*\$?\s*\d{1,3}(?:\s*[.,]\s*\d{3})+(?!\d)|clp\s*\$?\s*\d{4,9}(?!\d)/gi

const FECHA_TEXTO_RE =
  /\b(\d{1,2})\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|set|sept|oct|nov|dic)\.?\s+(\d{4})\b/gi

const FECHA_NUMERO_RE = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/g

type Intervalo = { index: number; fin: number }

type Token =
  | { tipo: "folio"; valor: string; tipoDocumento: TipoDocumento; index: number; fin: number }
  | { tipo: "monto"; valor: number; total: boolean; index: number; fin: number }
  | { tipo: "fecha"; valor: string; index: number; fin: number }

function isoValida(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const fecha = new Date(Date.UTC(year, month - 1, day))
  if (fecha.getUTCFullYear() !== year || fecha.getUTCMonth() !== month - 1 || fecha.getUTCDate() !== day) return null
  const mes = String(month).padStart(2, "0")
  const dia = String(day).padStart(2, "0")
  return `${year}-${mes}-${dia}`
}

function folioDe(cuerpo: string): string | null {
  const digitos = cuerpo.replace(/\D/g, "")
  if (digitos.length < 5 || digitos.length > 12) return null
  return digitos
}

function montoDe(texto: string): number | null {
  const compacto = texto.replace(/clp/gi, "").replace(/\$/g, "").replace(/\s/g, "")
  let digitos = ""
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(compacto)) digitos = compacto.replace(/[.,]/g, "")
  else if (/^\d{1,3}(?:[.,]\d{3})+[.,]\d{1,2}$/.test(compacto)) {
    digitos = compacto.replace(/[.,]\d{1,2}$/, "").replace(/[.,]/g, "")
  } else if (/^\d+$/.test(compacto)) digitos = compacto
  if (!digitos) return null
  const monto = Number(digitos)
  if (!Number.isSafeInteger(monto) || monto <= 0) return null
  return monto
}

function cruza(index: number, fin: number, intervalos: Intervalo[]): boolean {
  return intervalos.some((intervalo) => index < intervalo.fin && fin > intervalo.index)
}

function etiquetaTotal(fragmento: string): boolean {
  const texto = fragmento.toLowerCase().replace(/subtotal/g, " ")
  return /\btotal\b/.test(texto) || /\ba pagar\b/.test(texto) || /\bmonto pagado\b/.test(texto)
}

function tipoCerca(texto: string, index: number, fin: number): TipoDocumento {
  const alrededor = texto.slice(Math.max(0, index - 24), fin).toLowerCase()
  if (/\bboleta\b/.test(alrededor)) return "boleta"
  return "factura"
}

function fechaNumero(diaOMes: number, mesODia: number, year: number): string | null {
  if (mesODia > 12 && diaOMes <= 12) return isoValida(year, diaOMes, mesODia)
  return isoValida(year, mesODia, diaOMes)
}

function proveedorDe(texto: string): string | null {
  const candidatos = [
    { nombre: "Aguas Andinas", index: texto.search(/aguas\s*andinas/i) },
    { nombre: "Agrosuper", index: texto.search(/agrosuper/i) },
    { nombre: "Gasco", index: texto.search(/gasco/i) },
  ].filter((candidato) => candidato.index >= 0)
  candidatos.sort((a, b) => a.index - b.index)
  return candidatos[0]?.nombre ?? null
}

function buscarSubconjunto(
  documentos: DocumentoLeido[],
  total: number,
  cantidad: number | null,
): DocumentoLeido[] | null {
  const n = documentos.length
  if (n === 0 || n > 20) return null
  let mejor: number | null = null
  let mejorCantidad = -1
  for (let mascara = 1; mascara < 1 << n; mascara++) {
    let suma = 0
    let cuenta = 0
    for (let i = 0; i < n; i++) {
      if ((mascara & (1 << i)) === 0) continue
      suma += documentos[i].monto
      cuenta++
    }
    if (suma !== total) continue
    if (cantidad != null && cuenta !== cantidad) continue
    if (mejor == null || cuenta > mejorCantidad || (cuenta === mejorCantidad && mascara < mejor)) {
      mejor = mascara
      mejorCantidad = cuenta
    }
  }
  if (mejor == null) return null
  const elegida = mejor
  return documentos.filter((_, indice) => (elegida & (1 << indice)) !== 0)
}

function elegirDocumentos(
  documentos: DocumentoLeido[],
  total: number | null,
  cantidad: number | null,
): DocumentoLeido[] {
  if (documentos.length === 0 || total == null) return documentos
  const exacto = buscarSubconjunto(documentos, total, cantidad)
  if (exacto) return exacto
  if (cantidad != null) {
    const cualquiera = buscarSubconjunto(documentos, total, null)
    if (cualquiera) return cualquiera
  }
  return documentos
}

function lineaAnteriorProhibida(texto: string, index: number): boolean {
  const previo = texto.slice(Math.max(0, index - 40), index).toLowerCase()
  return /(cliente|rut|tel[eé]fono|c[oó]digo|autorizaci[oó]n)\s*$/i.test(previo.trim())
}

export function leerTexto(entrada: string): Lectura {
  const texto = entrada.replace(/\u00a0/g, " ")
  const ocupados: Intervalo[] = []
  const tokens: Token[] = []

  for (const match of texto.matchAll(FOLIO_RE)) {
    const cuerpo = match[1]
    if (!cuerpo || match.index == null) continue
    const folio = folioDe(cuerpo)
    if (!folio) continue
    const index = match.index
    const fin = index + match[0].length
    if (cruza(index, fin, ocupados)) continue
    ocupados.push({ index, fin })
    tokens.push({ tipo: "folio", valor: folio, tipoDocumento: tipoCerca(texto, index, fin), index, fin })
  }

  for (const match of texto.matchAll(FOLIO_LINEA_RE)) {
    const cuerpo = match[1]
    if (!cuerpo || match.index == null) continue
    if (lineaAnteriorProhibida(texto, match.index)) continue
    const folio = folioDe(cuerpo)
    if (!folio) continue
    const index = match.index
    const fin = index + match[0].length
    if (cruza(index, fin, ocupados)) continue
    if (tokens.some((token) => token.tipo === "folio" && token.valor === folio)) continue
    ocupados.push({ index, fin })
    tokens.push({ tipo: "folio", valor: folio, tipoDocumento: tipoCerca(texto, index, fin), index, fin })
  }

  for (const match of texto.matchAll(FECHA_TEXTO_RE)) {
    if (match.index == null) continue
    const dia = Number(match[1])
    const mes = MESES[(match[2] ?? "").toLowerCase()]
    const year = Number(match[3])
    const valor = mes ? isoValida(year, mes, dia) : null
    if (!valor) continue
    const index = match.index
    const fin = index + match[0].length
    if (cruza(index, fin, ocupados)) continue
    ocupados.push({ index, fin })
    tokens.push({ tipo: "fecha", valor, index, fin })
  }

  for (const match of texto.matchAll(FECHA_NUMERO_RE)) {
    if (match.index == null) continue
    const valor = fechaNumero(Number(match[1]), Number(match[2]), Number(match[3]))
    if (!valor) continue
    const index = match.index
    const fin = index + match[0].length
    if (cruza(index, fin, ocupados)) continue
    ocupados.push({ index, fin })
    tokens.push({ tipo: "fecha", valor, index, fin })
  }

  for (const match of texto.matchAll(MONTO_RE)) {
    if (match.index == null) continue
    const valor = montoDe(match[0])
    if (valor == null) continue
    const index = match.index
    const fin = index + match[0].length
    if (cruza(index, fin, ocupados)) continue
    const desde = Math.max(0, index - 80)
    const total = etiquetaTotal(texto.slice(desde, index))
    ocupados.push({ index, fin })
    tokens.push({ tipo: "monto", valor, total, index, fin })
  }

  tokens.sort((a, b) => a.index - b.index || a.fin - b.fin)

  const seleccion = texto.match(/(\d{1,2})\s+documentos?\s+seleccionad[oa]s?/i)
  const cantidad = seleccion ? Number(seleccion[1]) : null
  const cantidadUtil = cantidad != null && cantidad >= 1 && cantidad <= 20 ? cantidad : null

  const pares: DocumentoLeido[] = []
  const totales: number[] = []
  const fechasSueltas: string[] = []
  let actual: DocumentoLeido | null = null

  function cerrarActual() {
    if (actual && actual.monto > 0 && !pares.some((documento) => documento.folio === actual?.folio)) {
      pares.push(actual)
    }
    actual = null
  }

  for (const token of tokens) {
    if (token.tipo === "folio") {
      cerrarActual()
      actual = { folio: token.valor, monto: 0, fecha: "", tipo: token.tipoDocumento }
      continue
    }
    if (token.tipo === "fecha") {
      if (actual && !actual.fecha) actual.fecha = token.valor
      else if (!actual) fechasSueltas.push(token.valor)
      continue
    }
    if (token.total) {
      totales.push(token.valor)
      continue
    }
    if (actual && actual.monto === 0) actual.monto = token.valor
  }
  cerrarActual()

  const total = totales.length > 0 ? totales[totales.length - 1] : null
  const documentos = elegirDocumentos(pares, total, cantidadUtil)
  const fechaPago = fechaDePago(texto, tokens) ?? fechasSueltas[0] ?? null

  return {
    monto: total ?? (documentos.length > 0 ? documentos.reduce((suma, documento) => suma + documento.monto, 0) : null),
    documentos,
    proveedor: proveedorDe(texto),
    fecha: fechaPago,
  }
}

function fechaDePago(texto: string, tokens: Token[]): string | null {
  const marca = /fecha\s+de\s+pago/i.exec(texto)
  if (!marca || marca.index == null) return null
  const fecha = tokens.find(
    (token) => token.tipo === "fecha" && token.index >= marca.index && token.index <= marca.index + 48,
  )
  return fecha && fecha.tipo === "fecha" ? fecha.valor : null
}

export function combinarLecturas(lecturas: Lectura[]): Lectura {
  const documentos: DocumentoLeido[] = []
  const folios = new Set<string>()
  let monto: number | null = null
  let proveedor: string | null = null
  let fecha: string | null = null
  for (const lectura of lecturas) {
    if (monto == null && lectura.monto != null) monto = lectura.monto
    if (!proveedor && lectura.proveedor) proveedor = lectura.proveedor
    if (!fecha && lectura.fecha) fecha = lectura.fecha
    for (const documento of lectura.documentos) {
      if (folios.has(documento.folio)) continue
      folios.add(documento.folio)
      documentos.push(documento)
    }
  }
  return { monto, documentos, proveedor, fecha }
}
