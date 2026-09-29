import type { TipoDocumento } from "./types"

export type DocumentoLeido = {
  folio: string
  monto: number
  fecha: string
  tipo: TipoDocumento
}

export type MontoCandidato = {
  valor: number
  etiqueta: string
}

export type Lectura = {
  monto: number | null
  documentos: DocumentoLeido[]
  montosCandidatos: MontoCandidato[]
  foliosCandidatos: DocumentoLeido[]
  proveedor: string | null
  fecha: string | null
  descripcion: string | null
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
  /(?:#\s*|(?:^|[^A-Za-zÁÉÍÓÚáéíóúÑñ])(?:folio\s*:?\s*(?:n[°ºo0*.]{0,3}\s*:?\s*)?|(?:factura|boleta|documento|doc\.?)\s+[a-záéíóúñ]{3,14}\s*n[°ºo0*.]{0,3}\s*:?\s*|(?:factura|boleta|documento|doc\.?)\s*(?:n[°ºo0*.]{0,3}\s*:?\s*)?))(\d{5,12}|\d{1,3}(?:[.,]\d{3}){1,3})(?!\d)/gi

const FOLIO_LINEA_RE =
  /(?:^|\n)\s*n[°ºo]\.?\s*:?\s*(\d{5,12}|\d{1,3}(?:[.,]\d{3}){1,3})(?!\d)/gi

const MONTO_RE =
  /\$\s*\d{1,3}(?:\s*[.,]\s*\d{3})+(?:\s*clp)?(?!\d)|\$\s*\d{1,3}(?:[ \u00a0]\d{3})+(?!\d)|\$\s*\d{4,9}(?!\d)|(?<![#\d])\d{1,3}(?:\s*[.,]\s*\d{3})+(?:\s*clp)?(?!\d)|(?<![#\d])\d{4,9}\s*clp(?!\d)|clp\s*\$?\s*\d{1,3}(?:\s*[.,]\s*\d{3})+(?!\d)|clp\s*\$?\s*\d{4,9}(?!\d)/gi

const FECHA_TEXTO_RE =
  /\b(\d{1,2})\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|set|sept|oct|nov|dic)\.?\s+(\d{4})\b/gi

const FECHA_NUMERO_RE = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/g

const FECHA_ISO_RE = /\b(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})\b/g

const DISTANCIA_FOLIO_MONTO = 120

type Intervalo = { index: number; fin: number }

type RolMonto = "total" | "cargo" | "vuelto" | "iva" | "neto" | "subtotal" | null

type Token =
  | { tipo: "folio"; valor: string; tipoDocumento: TipoDocumento; index: number; fin: number }
  | { tipo: "monto"; valor: number; rol: RolMonto; ignorar: boolean; index: number; fin: number }
  | { tipo: "fecha"; valor: string; index: number; fin: number }

const VALOR_PALABRA: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiun: 21,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900,
}

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

function sinAcento(texto: string) {
  return texto
    .toLowerCase()
    .replace(/á/g, "a")
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u")
    .replace(/ü/g, "u")
}

function rolCercano(fragmento: string): RolMonto {
  const lineas = sinAcento(fragmento).split("\n")
  const ultima = lineas[lineas.length - 1] ?? ""
  if (/[a-z]/.test(ultima)) return rolDeLinea(ultima)
  const anterior = lineas[lineas.length - 2] ?? ""
  return esEncabezado(anterior) ? null : rolDeLinea(`${anterior}\n${ultima}`)
}

function esEncabezado(linea: string): boolean {
  return linea.trim().split(/\s+/).filter(Boolean).length > 4
}

function rolDeLinea(texto: string): RolMonto {
  const marcas: [Exclude<RolMonto, null>, RegExp][] = [
    ["iva", /total\s*iva/g],
    ["iva", /(?<![a-z])iva(?![a-z])/g],
    ["neto", /(?<![a-z])[hn]eto(?![a-z])/g],
    ["subtotal", /sub\s*total/g],
    ["vuelto", /(?<![a-z])(?:vuelto|cambio|propina)(?![a-z])/g],
    ["total", /(?<![a-z])total(?![a-z])/g],
    ["total", /a\s+pagar/g],
    ["cargo", /(?<![a-z])monto(?!s)(?!\s*(?:neto|iva|exento|afecto|bruto|descuento))/g],
    ["cargo", /(?<![a-z])(?:credito|debito|efectivo|abono|redcompra)(?![a-z])/g],
  ]
  const prioridad: Record<Exclude<RolMonto, null>, number> = {
    iva: 6,
    neto: 5,
    subtotal: 4,
    vuelto: 3,
    cargo: 2,
    total: 1,
  }
  let ultimo: { rol: Exclude<RolMonto, null>; fin: number } | null = null
  for (const [rol, expresion] of marcas) {
    for (const match of texto.matchAll(expresion)) {
      if (match.index == null) continue
      const fin = match.index + match[0].length
      if (!ultimo || fin > ultimo.fin || (fin === ultimo.fin && prioridad[rol] > prioridad[ultimo.rol])) {
        ultimo = { rol, fin }
      }
    }
  }
  return ultimo?.rol ?? null
}

function interpretarPalabras(palabras: string[]): number | null {
  let total = 0
  let grupo = 0
  let alguna = false
  for (const palabra of palabras) {
    if (palabra === "y" || palabra === "de") continue
    if (palabra === "mil") {
      grupo = (grupo || 1) * 1000
      total += grupo
      grupo = 0
      alguna = true
      continue
    }
    if (palabra === "millon" || palabra === "millones") {
      grupo = (grupo || 1) * 1_000_000
      total += grupo
      grupo = 0
      alguna = true
      continue
    }
    const valor = VALOR_PALABRA[palabra]
    if (valor == null) return null
    alguna = true
    if (valor < 10 && grupo % 100 >= 20 && grupo % 10 === 0) grupo += valor
    else grupo += valor
  }
  if (!alguna) return null
  const monto = total + grupo
  return monto > 0 ? monto : null
}

function montoEnPalabras(texto: string): number | null {
  const plano = sinAcento(texto).replace(/[^a-z\n]+/g, " ").replace(/\s+/g, " ")
  const frase = plano.match(/son\s+((?:[a-z]+\s+){1,14})pesos/)
  if (!frase?.[1]) return null
  return interpretarPalabras(frase[1].trim().split(" "))
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

const LINEA_VALOR = /^\$?\s*(?:\d{1,3}(?:[.,]\d{3})+|\d{1,9})\s*\$?$/

function esValor(linea: string): boolean {
  return LINEA_VALOR.test(linea.trim())
}

function esEtiqueta(linea: string): boolean {
  const limpia = linea.trim()
  if ((limpia.match(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/g) ?? []).length < 2) return false
  return !/\d{1,3}[.,]\d{3}|\d{3,}/.test(limpia)
}

// El OCR de una boleta angosta suele soltar las etiquetas en un bloque y sus
// montos en otro. Cuando los dos bloques tienen el mismo largo, se juntan línea
// a línea para que cada monto recupere su etiqueta.
function alinearColumnas(texto: string): string {
  const lineas = texto.split("\n")
  const salida: string[] = []
  let inicio = 0
  while (inicio < lineas.length) {
    let finEtiquetas = inicio
    while (finEtiquetas < lineas.length && esEtiqueta(lineas[finEtiquetas])) finEtiquetas++
    const etiquetas = finEtiquetas - inicio
    if (etiquetas < 2) {
      salida.push(lineas[inicio])
      inicio++
      continue
    }
    let finValores = finEtiquetas
    while (finValores < lineas.length && esValor(lineas[finValores])) finValores++
    if (finValores - finEtiquetas !== etiquetas) {
      for (let linea = inicio; linea < finEtiquetas; linea++) salida.push(lineas[linea])
      inicio = finEtiquetas
      continue
    }
    for (let paso = 0; paso < etiquetas; paso++) {
      salida.push(`${lineas[inicio + paso].trim()} ${lineas[finEtiquetas + paso].trim()}`)
    }
    inicio = finValores
  }
  return salida.join("\n")
}

function esRut(texto: string, index: number, fin: number): boolean {
  if (/^\s*-\s*[\dkK](?![\dkK])/.test(texto.slice(fin, fin + 4))) return true
  return /r\.?\s*u\.?\s*t\.?\s*:?\s*$/i.test(texto.slice(Math.max(0, index - 12), index))
}

function cargoDe(montos: Extract<Token, { tipo: "monto" }>[]): number | null {
  return [...montos].reverse().find((monto) => !monto.ignorar && monto.rol === "cargo")?.valor ?? null
}

function lineaAnteriorProhibida(texto: string, index: number): boolean {
  const previo = texto.slice(Math.max(0, index - 48), index).toLowerCase()
  return /(cliente|rut|tel[eé]fono|c[oó]digo|autorizaci[oó]n|operaci[oó]n|voucher|terminal|comercio|cuota)[^\n]{0,16}$/i.test(previo.trim())
}

export function leerTexto(entrada: string): Lectura {
  const texto = alinearColumnas(entrada.replace(/\u00a0/g, " "))
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

  for (const match of texto.matchAll(FECHA_ISO_RE)) {
    if (match.index == null) continue
    const valor = isoValida(Number(match[1]), Number(match[2]), Number(match[3]))
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
    if (esRut(texto, index, fin)) continue
    const desde = Math.max(0, index - 120)
    const rol = rolCercano(texto.slice(desde, index))
    ocupados.push({ index, fin })
    tokens.push({ tipo: "monto", valor, rol, ignorar: false, index, fin })
  }

  const montos = tokens.filter((token) => token.tipo === "monto")
  for (const monto of montos) {
    if (monto.rol === "iva" || monto.rol === "neto") monto.ignorar = true
  }
  if (montos.some((monto) => monto.rol !== "vuelto" && monto.rol !== "iva" && monto.rol !== "neto")) {
    for (const monto of montos) {
      if (monto.rol === "vuelto") monto.ignorar = true
    }
  }

  tokens.sort((a, b) => a.index - b.index || a.fin - b.fin)

  const seleccion = texto.match(/(\d{1,2})\s+documentos?\s+seleccionad[oa]s?/i)
  const cantidad = seleccion ? Number(seleccion[1]) : null
  const cantidadUtil = cantidad != null && cantidad >= 1 && cantidad <= 20 ? cantidad : null

  const pares: DocumentoLeido[] = []
  const foliosCandidatos: DocumentoLeido[] = []
  const totales: number[] = []
  const subtotales: number[] = []
  const netos: number[] = []
  const ivas: number[] = []
  const fechasSueltas: string[] = []
  let actual: DocumentoLeido | null = null
  let finFolio = 0
  const marcados = new Set<string>()

  function cerrarActual() {
    if (actual && !foliosCandidatos.some((documento) => documento.folio === actual?.folio)) {
      foliosCandidatos.push(actual)
      if (actual.monto > 0) pares.push(actual)
    }
    actual = null
  }

  for (const token of tokens) {
    if (token.tipo === "folio") {
      cerrarActual()
      actual = { folio: token.valor, monto: 0, fecha: "", tipo: token.tipoDocumento }
      finFolio = token.fin
      continue
    }
    if (token.tipo === "fecha") {
      if (actual && !actual.fecha) actual.fecha = token.valor
      else if (!actual) fechasSueltas.push(token.valor)
      continue
    }
    if (token.tipo === "monto" && token.rol === "neto") {
      netos.push(token.valor)
      continue
    }
    if (token.tipo === "monto" && token.rol === "iva") {
      ivas.push(token.valor)
      continue
    }
    if (token.tipo === "monto" && token.ignorar) continue
    if (token.tipo === "monto" && token.rol === "total") {
      totales.push(token.valor)
      continue
    }
    if (token.tipo === "monto" && token.rol === "subtotal") {
      subtotales.push(token.valor)
      continue
    }
    if (token.tipo === "monto" && actual && actual.monto === 0 && token.index - finFolio <= DISTANCIA_FOLIO_MONTO) {
      actual.monto = token.valor
      if (/seleccionad/.test(sinAcento(texto.slice(finFolio, token.index)))) marcados.add(actual.folio)
    }
  }
  cerrarActual()

  const total = totales.length > 0 ? totales[totales.length - 1] : null
  const subtotal = subtotales.length > 0 ? subtotales[subtotales.length - 1] : null
  const neto = netos.length > 0 ? netos[netos.length - 1] : null
  const iva = ivas.length > 0 ? ivas[ivas.length - 1] : null
  const sumaFiscal = neto != null && iva != null ? neto + iva : null
  const comprobado = [cargoDe(montos), total, subtotal].find((valor) => valor != null && valor === sumaFiscal) ?? null
  const elegidos = pares.filter((documento) => marcados.has(documento.folio))
  const emparejados =
    elegidos.length > 0 ? elegidos : elegirDocumentos(pares, comprobado ?? total ?? subtotal, cantidadUtil)
  const palabras = montoEnPalabras(texto)
  const utiles = montos.filter((monto) => !monto.ignorar)
  const igualPalabras = palabras != null ? utiles.find((monto) => monto.valor === palabras)?.valor ?? null : null
  const cargo = cargoDe(montos)
  const valoresUtiles = new Set(utiles.map((monto) => monto.valor))
  const unico = valoresUtiles.size === 1 ? utiles[0].valor : null
  const suma = emparejados.reduce((acumulado, documento) => acumulado + documento.monto, 0)
  const monto =
    comprobado ?? cargo ?? total ?? subtotal ?? igualPalabras ?? (emparejados.length > 0 ? suma : null) ?? unico ?? palabras
  const documentos =
    foliosCandidatos.length === 1 && monto != null ? [{ ...foliosCandidatos[0], monto }] : emparejados
  const fechaUnica = documentos.length === 1 ? documentos[0].fecha || null : null
  const fechaPago = fechaDePago(texto, tokens) ?? fechasSueltas[0] ?? fechaUnica

  return {
    monto,
    documentos,
    montosCandidatos: candidatosDeMonto(montos),
    foliosCandidatos,
    proveedor: proveedorDe(texto),
    fecha: fechaPago,
    descripcion: descripcionDe(texto),
  }
}

const ETIQUETA_ROL: Record<Exclude<RolMonto, null>, string> = {
  total: "Total",
  cargo: "Pagado con tarjeta",
  vuelto: "Vuelto",
  iva: "IVA",
  neto: "Neto",
  subtotal: "Subtotal",
}

function candidatosDeMonto(montos: Extract<Token, { tipo: "monto" }>[]): MontoCandidato[] {
  const vistos = new Map<string, MontoCandidato>()
  for (const monto of montos) {
    const etiqueta = monto.rol ? ETIQUETA_ROL[monto.rol] : "Sin etiqueta"
    const clave = `${monto.valor}-${etiqueta}`
    if (!vistos.has(clave)) vistos.set(clave, { valor: monto.valor, etiqueta })
  }
  const todos = [...vistos.values()]
  const etiquetados = todos.filter((candidato) => candidato.etiqueta !== "Sin etiqueta")
  return etiquetados.length > 0 ? etiquetados : todos.slice(0, 12)
}

function descripcionDe(texto: string): string | null {
  if (/pagar en l[ií]nea/i.test(texto)) return "Pago en línea"
  if (/recarga/i.test(texto)) return "Recarga"
  if (/webpay/i.test(texto)) return "Webpay"
  return null
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
  const foliosCandidatos: DocumentoLeido[] = []
  const montosCandidatos: MontoCandidato[] = []
  const folios = new Set<string>()
  const candidatos = new Set<string>()
  const montosVistos = new Set<string>()
  let monto: number | null = null
  let proveedor: string | null = null
  let fecha: string | null = null
  let descripcion: string | null = null
  for (const lectura of lecturas) {
    if (monto == null && lectura.monto != null) monto = lectura.monto
    if (!proveedor && lectura.proveedor) proveedor = lectura.proveedor
    if (!fecha && lectura.fecha) fecha = lectura.fecha
    if (!descripcion && lectura.descripcion) descripcion = lectura.descripcion
    for (const documento of lectura.documentos) {
      if (folios.has(documento.folio)) continue
      folios.add(documento.folio)
      documentos.push(documento)
    }
    for (const documento of lectura.foliosCandidatos) {
      if (candidatos.has(documento.folio)) continue
      candidatos.add(documento.folio)
      foliosCandidatos.push(documento)
    }
    for (const candidato of lectura.montosCandidatos) {
      const clave = `${candidato.valor}-${candidato.etiqueta}`
      if (montosVistos.has(clave)) continue
      montosVistos.add(clave)
      montosCandidatos.push(candidato)
    }
  }
  return { monto, documentos, montosCandidatos, foliosCandidatos, proveedor, fecha, descripcion }
}
