import { Encabezado } from "@/components/encabezado"
import { PagoForm } from "@/components/pago-form"
import { listarPagos } from "@/lib/store"

export const dynamic = "force-dynamic"

function fechaDeHoy() {
  const ahora = new Date()
  const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export default async function NuevoPago() {
  const pagos = await listarPagos()
  const tarjetas = [...new Set(pagos.map((pago) => pago.tarjeta))]

  return (
    <>
      <Encabezado accion={false} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="font-display text-3xl font-medium">Registrar pago</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Anota el cargo de la tarjeta en el momento en que pagas y guarda la captura de la pantalla.
          </p>
        </div>
        <PagoForm tarjetas={tarjetas} fechaInicial={fechaDeHoy()} />
      </main>
    </>
  )
}
