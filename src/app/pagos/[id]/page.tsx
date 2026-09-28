import Link from "next/link"
import { notFound } from "next/navigation"
import { CuadreBadge, PanelCuadre } from "@/components/cuadre-badge"
import { EliminarPago } from "@/components/eliminar-pago"
import { Encabezado } from "@/components/encabezado"
import { FotoGaleria } from "@/components/foto-galeria"
import { buttonVariants } from "@/components/ui/button"
import { cuadreDe, etiquetaTipo, formatCLP, formatFecha, formatFechaLarga, mesDeFecha } from "@/lib/format"
import { obtenerPago } from "@/lib/store"

export const dynamic = "force-dynamic"

export default async function DetallePago({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pago = await obtenerPago(id)
  if (!pago) notFound()
  const cuadre = cuadreDe(pago.monto, pago.documentos)

  return (
    <>
      <Encabezado />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <div>
          <Link href="/" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
            Volver a los pagos
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{formatFechaLarga(pago.fecha)}</p>
              <h1 className="font-display text-3xl font-medium">{pago.proveedor}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {[pago.descripcion, pago.tarjeta].filter(Boolean).join(" · ")}
              </p>
            </div>
            {pago.ejemplo ? (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">Ejemplo</span>
            ) : null}
          </div>
        </div>

        <PanelCuadre monto={pago.monto} documentos={pago.documentos} />

        <section className="grid gap-3">
          <h2 className="font-display text-xl font-medium">Capturas</h2>
          <FotoGaleria fotos={pago.fotos} pagoId={pago.id} />
        </section>

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-medium">Documentos</h2>
            <CuadreBadge cuadre={cuadre} />
          </div>
          {pago.documentos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              Todavía no hay facturas ni boletas en este pago. El cargo de la tarjeta queda pendiente de cuadre.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              {pago.documentos.map((documento) => (
                <li
                  key={documento.id}
                  className="grid gap-1 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <p className="font-medium tabular-nums">{documento.folio || "Sin folio"}</p>
                    <p className="text-sm text-muted-foreground">
                      {etiquetaTipo(documento.tipo)}
                      {documento.fecha ? ` · ${formatFecha(documento.fecha)}` : ""}
                    </p>
                  </div>
                  <p className="font-display text-lg font-medium tabular-nums sm:text-right">
                    {formatCLP(documento.monto)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <a
            href={`/api/rendicion?mes=${mesDeFecha(pago.fecha)}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Exportar mes
          </a>
          <Link href={`/pagos/${pago.id}/editar`} className={buttonVariants({ variant: "outline" })}>
            Editar
          </Link>
          <EliminarPago id={pago.id} proveedor={pago.proveedor} />
        </div>
      </main>
    </>
  )
}
