import { cn } from "cn"
import { cuadreDe, etiquetaCuadre, formatCLP } from "@/lib/format"
import type { Cuadre } from "@/lib/types"

const estilos: Record<Cuadre["estado"], string> = {
  cuadra: "bg-emerald-100 text-emerald-950",
  falta: "bg-amber-100 text-amber-950",
  sobra: "bg-rose-100 text-rose-950",
  sin_documentos: "bg-stone-200 text-stone-800",
}

export function CuadreBadge({ cuadre }: { cuadre: Cuadre }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        estilos[cuadre.estado],
      )}
    >
      {etiquetaCuadre(cuadre)}
    </span>
  )
}

export function PanelCuadre({
  monto,
  documentos,
}: {
  monto: number
  documentos: { folio: string; monto: number }[]
}) {
  const cuadre = cuadreDe(monto, documentos)

  return (
    <section className="rounded-xl bg-secondary/70 p-4 ring-1 ring-foreground/10">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Monto del pago</p>
          <p className="font-display mt-1 text-2xl font-medium tabular-nums">{formatCLP(monto || 0)}</p>
        </div>
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Documentos</p>
          <p className="font-display mt-1 text-2xl font-medium tabular-nums">{formatCLP(cuadre.suma)}</p>
        </div>
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Diferencia</p>
          <p className="font-display mt-1 text-2xl font-medium tabular-nums">
            {formatCLP(Math.abs(cuadre.diferencia))}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <CuadreBadge cuadre={cuadre} />
      </div>
    </section>
  )
}
