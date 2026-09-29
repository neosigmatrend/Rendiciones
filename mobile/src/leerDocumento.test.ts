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
assert.ok(leerTexto(gasco).montosCandidatos.some((item) => item.valor === 405057))

const montoGrandeSinEtiqueta = `
13.600
NETO: $ 11.429
IVA: $ 2.171
`
assert.equal(leerTexto(montoGrandeSinEtiqueta).monto, 13600)
assert.ok(leerTexto(montoGrandeSinEtiqueta).montosCandidatos.some((item) => item.valor === 13600))
assert.deepEqual(leerTexto(gasco).foliosCandidatos.map((item) => item.folio), ["12214585", "12210001", "12215855"])
assert.deepEqual(leerTexto(gasco).documentos.map((item) => item.folio), ["12214585", "12215855"])

const gascoCuotas = `
Detalle de cuenta a pagar
Documento N° 11985932 Recarga
1 Cuota seleccionada - $286.939
Documento N° 11985934 Recarga
1 Cuota seleccionada - $177.494
Documento N° 12004244 Recarga
Documento N° 12004249 Recarga
Cargo por convenio 14.420
`
assert.deepEqual(
  leerTexto(gascoCuotas).foliosCandidatos.map((item) => item.folio),
  ["11985932", "11985934", "12004244", "12004249"],
)
assert.deepEqual(
  leerTexto(gascoCuotas).documentos.map((item) => `${item.folio} ${item.monto}`),
  ["11985932 286939", "11985934 177494"],
)
assert.equal(leerTexto(gascoCuotas).monto, 464433)

const facturaElectronica = `
TOTEAT S.A.
Giro: ACTIVIDADES DE CONSULTORIA DE INFORMATICA Y DE
AV NUEVA COSTANERA 3605 OF 011-SANTIAGO-VITACURA
R.U.T.: 76.363.579-1
FACTURA ELECTRONICA
No. 181,176
S.I.I. - Santiago Oriente
Señor(es): GARCIA VARGAS RESTAURANTES LTDA
R.U.T.: 76.930.513-0
Giro: RESTAURANTES
No. Código Detalle U.M. Precio Cantidad Descto. Total
1 010100 TRM Fee Mensual 183,932 1 183,932
Periodo de Agosto 2026
Montos Totales
Neto: 183,932
Exento: 0
IVA 19%: 34,947
Total: 218,879
`
assert.equal(leerTexto(facturaElectronica).monto, 218879)
assert.deepEqual(
  leerTexto(facturaElectronica).documentos.map((item) => `${item.folio} ${item.monto}`),
  ["181176 218879"],
)
assert.equal(leerTexto(facturaElectronica).montosCandidatos.some((item) => item.valor === 76363579), false)

const facturaEnColumnas = `
FACTURA ELECTRONICA
No. 181,176
No. Código Detalle U.M. Precio Cantidad Descto. Total
1 010100 TRM Fee Mensual
183,932
1
183,932
Neto:
183,932
Exento:
0
IVA 19%:
34,947
Total:
218,879
`
assert.equal(leerTexto(facturaEnColumnas).monto, 218879)
assert.deepEqual(
  leerTexto(facturaEnColumnas).documentos.map((item) => `${item.folio} ${item.monto}`),
  ["181176 218879"],
)

const soloLineaDeDetalle = `
FACTURA ELECTRONICA
No. 900123
No. Código Detalle U.M. Precio Cantidad Descto. Total
1 010100 Servicio mensual
45,000
1
45,000
`
assert.equal(leerTexto(soloLineaDeDetalle).monto, 45000)

const boletaRevisionTecnica = `
RUT: 96888000-4
BOLETA ELECTRONICA No: 7196761
SII VALPARAISO
REVISIONES TECNICAS SAN DAMASO
GIRO: PLANTA DE REVISION TECNICA PARA VEHICULOS AUTOMOTORES
DIRECCION: AVDA. EYZAGUIRRE 3649 , PUENTE ALTO PUENTE ALTO
COMUNA: PUENTE ALTO
SRES: ROSA GRICEL BARRAZA BARRAZA
DIRECCION: JOAQUIN PALACIOS
COMUNA: CORDILLERA
RUT: 11876872-8
FORMA PAGO: TARJETA DE DEBITO
DETALLE:
1,00 X 13.600
INSP-R KDWW76 CLASS B - Automovil $ 13.600
OBSERVACIONES:
NETO: $ 11.429
IVA: $ 2.171
TOTAL: $ 13.600
FECHA: 2026-09-24
Timbre Electronico SII RES. 80 de 2014
`
const revision = leerTexto(boletaRevisionTecnica)
assert.equal(revision.monto, 13600)
assert.equal(revision.fecha, "2026-09-24")
assert.deepEqual(
  revision.documentos.map((item) => `${item.tipo} ${item.folio} ${item.monto} ${item.fecha}`),
  ["boleta 7196761 13600 2026-09-24"],
)
assert.equal(revision.montosCandidatos.some((item) => item.valor === 96888000), false)
assert.equal(revision.montosCandidatos.some((item) => item.valor === 11876872), false)

// Texto tal como lo devuelve OCR.space para esta boleta: las etiquetas en un
// bloque, sus montos en el siguiente, y NETO leído como HETO.
const boletaEnColumnas = `RUT: 96808
BOLETA FLECTRONICA No: 7196751
REVISIONES TECNICAS SAN DAMASO
GIRO: PLANTA DE REVISION TECNICA PARA VEMICULOS AUTOMOTORES
DIRECCION: AUDA. EYZAGUIRRE 3649, PUENTE ALTO PUENTE ALTO
COMUNA: PUENTE ALTO
SRES: ROSA GRICEL BARRAZA BARRAZA
DIRECCION: JOAQUIN PALACIOS
GIRO:
COMUNA: CORDILLERA
RUT: 11876872-8
FORMA PAGO: TARJETA DE DEBITO
DETALLE:
1.00 X 13.600
INSP-R KDUW76 CLASS B - Automovil
OBSERVACIONES:
13.600
HETO: $
IVA: $
TOTAL: $
11.429
2.171
13.600
FECHA: 2026-09-24
Timbre Electronico SII RES. 80 de 201`
const columnas = leerTexto(boletaEnColumnas)
assert.equal(columnas.monto, 13600)
assert.equal(columnas.fecha, "2026-09-24")
assert.deepEqual(
  columnas.documentos.map((item) => `${item.tipo} ${item.folio} ${item.monto}`),
  ["boleta 7196751 13600"],
)
assert.deepEqual(
  columnas.montosCandidatos.map((item) => `${item.valor} ${item.etiqueta}`),
  ["11429 Neto", "2171 IVA", "13600 Total"],
)

const facturaConPalabra = `
FACTURA ELECTRONICA No 884455
Total $ 90.000
`
assert.deepEqual(leerTexto(facturaConPalabra).documentos.map((item) => `${item.tipo} ${item.folio}`), [
  "factura 884455",
])

const facturaQuesos = `COD PROD
CAJ
838614509
827514520
2
NOMBRE
CANT
KILOS
83865F - QUESO MOZZARELLA NACIONAL
15.6
82750F - QUESO MANTECOSO RUMAY 6X1
7.8
PRECIO
4.950
5.800
NETO
IVA
TOTAL
19.0%
CONDICION VENTA
TRANSFERENCIA
Productos de Venta por Unidad: los kilos que se indican son solo referenciales.
VALOR
77.220
45.240
122.460
23.267
145.727`
const quesos = leerTexto(facturaQuesos)
assert.equal(quesos.monto, 145727)
assert.deepEqual(quesos.documentos, [])
assert.deepEqual(
  quesos.montosCandidatos.map((item) => `${item.valor} ${item.etiqueta}`),
  ["122460 Neto", "23267 IVA", "145727 Total"],
)

console.log("candidatos ok")
