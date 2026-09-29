import { folioBanco } from "@/lib/conciliar"
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
    "pago_id",
    "fecha",
    "proveedor",
    "descripcion",
    "tarjeta",
    "monto_pago",
    "folio_banco",
    "folio",
    "tipo",
    "fecha_documento",
    "monto_documento",
    "estado",
    "ejemplo",
  ]

  const filas = visibles.flatMap((pago) => {
    const estado = etiquetaCuadre(cuadreDe(pago.monto, pago.documentos))
    const ejemplo = pago.ejemplo ? "si" : "no"
    const base = [
      pago.id,
      pago.fecha,
      pago.proveedor,
      pago.descripcion,
      pago.tarjeta,
      pago.monto,
      folioBanco(pago.documentos),
    ]
    if (pago.documentos.length === 0) {
      return [[...base, "", "", "", "", estado, ejemplo]]
    }
    return pago.documentos.map((documento) => [
      ...base,
      documento.folio,
      documento.tipo,
      documento.fecha,
      documento.monto,
      estado,
      ejemplo,
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
