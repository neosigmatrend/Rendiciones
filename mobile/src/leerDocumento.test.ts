import assert from "node:assert/strict"
import { leerTexto } from "./leerDocumento.ts"

function folios(texto: string): string[] {
  return leerTexto(texto).documentos.map((documento) => documento.folio)
}

function montos(texto: string): number[] {
  return leerTexto(texto).documentos.map((documento) => documento.monto)
}

const agrosuper = `
Agrosuper
Pagar en línea
21 Sep 2026

#101070510
22 Ago 2026
53,480 CLP

#101069001
10 Ago 2026
55,287 CLP

#101070582
26 Ago 2026
113,067 CLP

Total a pagar
$166,547
2 documentos seleccionados
`

const gasco = `
Gasco
Cliente Granel
Cliente N° 12442757

Documento N° 12214585
Recarga
$405.057

Documento N° 12210001
Recarga

Documento Nº 12215855
Recarga
$175.122

Total
$580.179
`

const aguas = `
WEBPAY
Aguas Andinas
Fecha de pago 8/17/2026 10:58:57 PM
Total $211.060
PAGADO
`

assert.equal(leerTexto(agrosuper).proveedor, "Agrosuper")
assert.equal(leerTexto(agrosuper).descripcion, "Pago en línea")
assert.equal(leerTexto(agrosuper).fecha, "2026-09-21")
assert.equal(leerTexto(agrosuper).monto, 166547)
assert.deepEqual(folios(agrosuper), ["101070510", "101070582"])
assert.deepEqual(montos(agrosuper), [53480, 113067])
assert.equal(leerTexto(agrosuper).documentos[0]?.fecha, "2026-08-22")
assert.equal(leerTexto(agrosuper).documentos[1]?.fecha, "2026-08-26")

assert.equal(leerTexto(gasco).proveedor, "Gasco")
assert.equal(leerTexto(gasco).descripcion, "Recarga")
assert.equal(leerTexto(gasco).monto, 580179)
assert.deepEqual(folios(gasco), ["12214585", "12215855"])
assert.deepEqual(montos(gasco), [405057, 175122])
assert.equal(folios(gasco).includes("12442757"), false)
assert.equal(folios(gasco).includes("12210001"), false)

assert.equal(leerTexto(aguas).proveedor, "Aguas Andinas")
assert.equal(leerTexto(aguas).descripcion, "Webpay")
assert.equal(leerTexto(aguas).monto, 211060)
assert.deepEqual(leerTexto(aguas).documentos, [])
assert.equal(leerTexto(aguas).fecha, "2026-08-17")

const boleta = `
Boleta N° 445566
$12.000
Total $12.000
`
assert.equal(leerTexto(boleta).documentos[0]?.tipo, "boleta")
assert.equal(leerTexto(boleta).documentos[0]?.folio, "445566")
assert.equal(leerTexto(boleta).monto, 12000)

const sinMoneda = `
#101070510
53.480
#101070582
113.067
Total
166.547
`
assert.equal(leerTexto(sinMoneda).monto, 166547)
assert.deepEqual(folios(sinMoneda), ["101070510", "101070582"])

const clienteEnOtraLinea = `
Cliente
N° 12442757
Documento
N° 12214585
$10.000
Total $10.000
`
assert.deepEqual(folios(clienteEnOtraLinea), ["12214585"])

const ocrAgrosuper = `
Agrosuper
Pagar en linea
21 Sep 2026
# 101070510
22 Ago 2026
53,480 CLP
# 101069001
10 Ago 2026
55,287 CLP
#101070582
26 Ago 2026
113,067 CLP
Total a pagar
$166,547
2 documentos seleccionados
`
assert.equal(leerTexto(ocrAgrosuper).monto, 166547)
assert.deepEqual(folios(ocrAgrosuper), ["101070510", "101070582"])
assert.equal(leerTexto(ocrAgrosuper).fecha, "2026-09-21")

const ocrGasco = `
Gasco
Cliente Granel
Cliente N 12442757
Documento N 12214585
Recarga
$405.057
Documento N 12210001
Recarga
Documento N 12215855
Recarga
$175.122
Total
$580.179
`
assert.equal(leerTexto(ocrGasco).monto, 580179)
assert.deepEqual(folios(ocrGasco), ["12214585", "12215855"])

const ocrAguas = `
WEBPAY
Aguas Andinas
Fecha de pago 8/17/2026 10:58:57 PM
Total $211.060
PAGADO
`
assert.equal(leerTexto(ocrAguas).monto, 211060)
assert.deepEqual(leerTexto(ocrAguas).documentos, [])
assert.equal(leerTexto(ocrAguas).fecha, "2026-08-17")

const boletaPapel = `
CREDITO S
VUELTO S
35.790
SON :
TREINTA Y CINCO MIL SETECIENTOS
NOVENTA PESOS
OFERTAS NO ACUMULABLES
`
assert.equal(leerTexto(boletaPapel).monto, 35790)
assert.deepEqual(leerTexto(boletaPapel).documentos, [])

const soloUnMonto = `
Comprobante
128.500
`
assert.equal(leerTexto(soloUnMonto).monto, 128500)
assert.deepEqual(leerTexto(soloUnMonto).documentos, [])

const enPalabras = `
SON: DIEZ MIL PESOS
`
assert.equal(leerTexto(enPalabras).monto, 10000)

const supermercado = `
JOSE PEDRO ALESSANDRI 1132
NUNOA - SANTIAGO
7802821007168 JUGO 1LT POMELO 5.490
6 X $1.740
7804610850788 LECHUGA HIDROP. L 10.440
4 X $1.740
7804610850795 LECHUGA HIDROP. LO 6.960
SUB TOTAL $ 22.890
TOTAL $ 22.890
NETO $ 19.236
TOTAL IVA 19,00% $ 3.654
T. CREDITO $ 22.890
VUELTO $ 0
`
assert.equal(leerTexto(supermercado).monto, 22890)
assert.deepEqual(leerTexto(supermercado).documentos, [])

const voucher = `
TRANSBANK
COMPRA
MONTO $ 45.990
NUMERO DE OPERACION
482193
CODIGO AUTORIZACION
551203
`
assert.equal(leerTexto(voucher).monto, 45990)
assert.deepEqual(leerTexto(voucher).documentos, [])

console.log("lectura ok")

const candidatos = leerTexto(supermercado)
assert.deepEqual(
  candidatos.montosCandidatos.map((item) => `${item.valor} ${item.etiqueta}`),
  ["22890 Subtotal", "22890 Total", "19236 Neto", "3654 IVA", "22890 Pagado con tarjeta"],
)
assert.deepEqual(
  leerTexto(voucher).montosCandidatos.map((item) => `${item.valor} ${item.etiqueta}`),
  ["45990 Pagado con tarjeta"],
)
assert.deepEqual(leerTexto(gasco).foliosCandidatos.map((item) => item.folio), ["12214585", "12210001", "12215855"])
assert.deepEqual(leerTexto(gasco).documentos.map((item) => item.folio), ["12214585", "12215855"])

console.log("candidatos ok")
