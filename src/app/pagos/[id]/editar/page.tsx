import Link from "next/link"
import { notFound } from "next/navigation"
import { Encabezado } from "@/components/encabezado"
import { FotoGaleria } from "@/components/foto-galeria"
import { PagoForm } from "@/components/pago-form"
import { listarPagos, obtenerPago } from "@/lib/store"

export const dynamic = "force-dynamic"

export default async function EditarPago({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pago = await obtenerPago(id)
  if (!pago) notFound()
  const pagos = await listarPagos()
  const tarjetas = [...new Set(pagos.map((item) => item.tarjeta))]

  return (
    <>
      <Encabezado accion={false} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
        <div>
          <Link
            href={`/pagos/${pago.id}`}
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            Volver al pago
          </Link>
          <h1 className="font-display mt-3 text-3xl font-medium">Editar {pago.proveedor}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Completa el folio cuando aparezca la factura o la boleta. La suma tiene que cerrar con el cargo.
          </p>
        </div>
        {pago.fotos.length > 0 ? (
          <section className="grid gap-3">
            <h2 className="font-display text-xl font-medium">Capturas guardadas</h2>
            <FotoGaleria fotos={pago.fotos} pagoId={pago.id} permitirQuitar />
          </section>
        ) : null}
        <PagoForm pago={pago} tarjetas={tarjetas} fechaInicial={pago.fecha} />
      </main>
    </>
  )
}
