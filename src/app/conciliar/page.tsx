import { Encabezado } from "@/components/encabezado"
import { ConciliarPanel } from "@/components/conciliar-panel"

export const metadata = {
  title: "Conciliar con la cartola",
}

export default function Conciliar() {
  return (
    <>
      <Encabezado />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <div>
          <h1 className="font-display text-3xl font-medium">Conciliar con la cartola</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Pega los movimientos de la tarjeta, carga los pagos que capturaste con el teléfono y la página devuelve las
            columnas CATEGORIA, FOLIO y OBS listas para pegar de vuelta en tu planilla. Los folios salen con tu formato:
            FA para facturas, BOL para boletas y el texto tal cual para los invoice.
          </p>
        </div>
        <ConciliarPanel />
      </main>
    </>
  )
}
