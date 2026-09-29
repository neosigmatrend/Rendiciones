import assert from "node:assert/strict"
import { conciliar, leerCartola, leerRendicion, parseFecha, parseMonto, tsvSalida } from "./conciliar.ts"

assert.equal(parseMonto("$143.790"), 143790)
assert.equal(parseMonto("143790"), 143790)
assert.equal(parseMonto("1.000,00"), 1000)
assert.equal(parseMonto("28.134"), 28134)
assert.equal(parseMonto("-$1.200"), -1200)
assert.equal(parseMonto("Titular"), null)
assert.equal(parseMonto(""), null)
assert.equal(parseMonto("0"), 0)

assert.equal(parseFecha("28-09-2026"), "2026-09-28")
assert.equal(parseFecha("28/09/2026"), "2026-09-28")
assert.equal(parseFecha("2026-09-28"), "2026-09-28")
assert.equal(parseFecha("09-28-2026"), "2026-09-28")
assert.equal(parseFecha("28-09-26"), "2026-09-28")
assert.equal(parseFecha("Titular"), "")

const cartola = [
  "FECHA\tDESCRIPCION\tTITULAR/ADICIONAL\tMONTO\tCUOTAS PENDIENTES\tVALOR CUOTA\tCATEGORIA\tFOLIO\tOBS",
  "28-09-2026\tCOMPRA ALVI.CL PAJARITOS OC*\tTitular\t$143.790\t0\t$143.790\t\t\t",
  "28-09-2026\tCOMPRA MERPAGO*MERCADOLIBRE*\tTitular\t$33.240\t0\t$33.240\t\t\t",
  "28-09-2026\tCOMPRA HDI SEGUROS PAT*\tTitular\t$98.775\t0\t$98.775\t\t\t",
  "24-09-2026\tCOMPRA JUMBO NUNOA\tTitular\t$28.134\t0\t$28.134\t\t\t",
  "24-09-2026\tPAGO TARJETA DE CREDITO\tTitular\t$450.000\t0\t$450.000\t\t\t",
].join("\n")

const leida = leerCartola(cartola)
assert.equal(leida.aviso, null)
assert.equal(leida.columnaCategoria, 7)
assert.equal(leida.filas.length, 5)
assert.deepEqual(
  leida.filas.map((fila) => `${fila.fecha} ${fila.monto}`),
  ["2026-09-28 143790", "2026-09-28 33240", "2026-09-28 98775", "2026-09-24 28134", "2026-09-24 450000"],
)
assert.equal(leida.filas[1].descripcion, "COMPRA MERPAGO*MERCADOLIBRE*")

const rendicion = [
  "\uFEFFpago_id;fecha;proveedor;descripcion;tarjeta;monto_pago;folio_banco;folio;tipo;fecha_documento;monto_documento;estado;ejemplo",
  "p1;2026-09-28;Mercado Libre;;Mastercard empresa;33240;FA 15433307-15433323-15433322;15433307;factura;2026-09-28;10793;Cuadra;no",
  "p1;2026-09-28;Mercado Libre;;Mastercard empresa;33240;FA 15433307-15433323-15433322;15433323;factura;;1513;Cuadra;no",
  "p1;2026-09-28;Mercado Libre;;Mastercard empresa;33240;FA 15433307-15433323-15433322;15433322;factura;;20934;Cuadra;no",
  "p2;2026-09-23;Jumbo Ñuñoa;;Mastercard empresa;28134;BOL 998877;998877;boleta;2026-09-23;28134;Cuadra;no",
  "p3;2026-09-28;HDI Seguros;;Mastercard empresa;98775;;;;;;Sin documentos;no",
].join("\n")

const pagos = leerRendicion(rendicion)
assert.equal(pagos.length, 3)
assert.equal(pagos[0].folio, "FA 15433307-15433323-15433322")
assert.equal(pagos[1].folio, "BOL 998877")
assert.equal(pagos[2].folio, "")

const sinColumnaFolioBanco = [
  "fecha;proveedor;monto_pago;folio;tipo",
  "2026-09-28;Toteat;218879;181176;factura",
  "2026-09-28;Toteat;218879;181177;factura",
].join("\n")
assert.equal(leerRendicion(sinColumnaFolioBanco)[0].folio, "FA 181176-181177")

const resultado = conciliar(leida.filas, pagos)
assert.deepEqual(
  resultado.map((item) => [item.categoria, item.folio, item.motivo]),
  [
    ["", "", "sin_pago"],
    ["RENDICION", "FA 15433307-15433323-15433322", "exacta"],
    ["RENDICION", "", "exacta"],
    ["RENDICION", "BOL 998877", "monto"],
    ["PTC", "", "sin_pago"],
  ],
)
assert.equal(resultado[2].obs, "Pago sin folio en la app")
assert.equal(resultado[3].obs, "Fecha en la app: 23-09-2026")

const manual = conciliar(leida.filas, pagos, { "fila-1": "" })
assert.equal(manual[1].pagoId, null)
assert.equal(manual[1].categoria, "")

const movido = conciliar(leida.filas, pagos, { "fila-0": "p1" })
assert.equal(movido[0].folio, "FA 15433307-15433323-15433322")
assert.equal(movido[1].pagoId, null)

assert.equal(
  tsvSalida(resultado.slice(1, 3)),
  ["RENDICION\tFA 15433307-15433323-15433322\t", "RENDICION\t\tPago sin folio en la app"].join("\n"),
)

const sinEncabezado = ["28-09-2026\tCOMPRA JUMBO NUNOA\tTitular\t$28.134", "27-09-2026\tCOMPRA COPELEC LTDA*\tTitular\t$75.685"].join("\n")
const suelta = leerCartola(sinEncabezado)
assert.equal(suelta.filas.length, 2)
assert.equal(suelta.filas[0].monto, 28134)
assert.equal(suelta.filas[1].descripcion, "COMPRA COPELEC LTDA*")
assert.ok(suelta.aviso)

assert.deepEqual(leerCartola("").filas, [])
assert.deepEqual(leerCartola("hola\tmundo").filas, [])

console.log("conciliacion ok")
