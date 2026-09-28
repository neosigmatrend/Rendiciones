import { cuadreDe, etiquetaCuadre, mesDeFecha } from "@/lib/format"
import { listarPagos } from "@/lib/store"

export const dynamic = "force-dynamic"

function celda(valor: string | number) {
  const texto = String(valor)
  if (/[";\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`
  return texto
}

export async function GET(request: Request) {
  const mes = new URL(request.url).searchParams.get("mes")
  const pagos = await listarPagos()
  const visibles = mes && /^\d{4}-\d{2}$/.test(mes) ? pagos.filter((pago) => mesDeFecha(pago.fecha) === mes) : pagos

  const encabezado = [
    "fecha",
    "proveedor",
    "descripcion",
    "tarjeta",
    "monto_pago",
    "folio",
    "tipo",
    "fecha_documento",
    "monto_documento",
    "estado",
    "ejemplo",
  ]

  const filas = visibles.flatMap((pago) => {
    const cuadre = cuadreDe(pago.monto, pago.documentos)
    const base = [
      pago.fecha,
      pago.proveedor,
      pago.descripcion,
      pago.tarjeta,
      pago.monto,
      pago.ejemplo ? "si" : "no",
    ]
    if (pago.documentos.length === 0) {
      return [[base[0], base[1], base[2], base[3], base[4], "", "", "", "", etiquetaCuadre(cuadre), base[5]]]
    }
    return pago.documentos.map((documento) => [
      pago.fecha,
      pago.proveedor,
      pago.descripcion,
      pago.tarjeta,
      pago.monto,
      documento.folio,
      documento.tipo,
      documento.fecha,
      documento.monto,
      etiquetaCuadre(cuadre),
      pago.ejemplo ? "si" : "no",
    ])
  })

  const csv = `\uFEFF${[encabezado, ...filas].map((fila) => fila.map(celda).join(";")).join("\n")}\n`
  const nombre = mes ? `rendicion-${mes}.csv` : "rendicion.csv"

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
    },
  })
}
