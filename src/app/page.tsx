import Link from "next/link"
import { Encabezado } from "@/components/encabezado"
import { CuadreBadge } from "@/components/cuadre-badge"
import { buttonVariants } from "@/components/ui/button"
import { cuadreDe, etiquetaMes, etiquetaTipo, formatCLP, formatFecha, mesDeFecha } from "@/lib/format"
import { listarPagos } from "@/lib/store"

export const dynamic = "force-dynamic"

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const { mes } = await searchParams
  const pagos = await listarPagos()
  const meses = [...new Set(pagos.map((pago) => mesDeFecha(pago.fecha)))].sort().reverse()
  const mesActivo = mes && meses.includes(mes) ? mes : null
  const visibles = mesActivo ? pagos.filter((pago) => mesDeFecha(pago.fecha) === mesActivo) : pagos
  const total = visibles.reduce((suma, pago) => suma + pago.monto, 0)
  const cuadrados = visibles.filter((pago) => cuadreDe(pago.monto, pago.documentos).estado === "cuadra").length
  const consulta = mesActivo ? `?mes=${mesActivo}` : ""

  return (
    <>
      <Encabezado />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Pagos</p>
            <p className="font-display mt-1 text-3xl font-medium tabular-nums">{visibles.length}</p>
          </article>
          <article className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">En tarjeta</p>
            <p className="font-display mt-1 text-3xl font-medium tabular-nums">{formatCLP(total)}</p>
          </article>
          <article className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Cuadrados</p>
            <p className="font-display mt-1 text-3xl font-medium tabular-nums">
              {cuadrados}
              <span className="text-lg text-muted-foreground"> / {visibles.length}</span>
            </p>
          </article>
        </section>

        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 overflow-x-auto">
            <Link
              href="/"
              className={buttonVariants({
                variant: mesActivo ? "outline" : "default",
                size: "sm",
              })}
            >
              Todos
            </Link>
            {meses.map((item) => (
              <Link
                key={item}
                href={`/?mes=${item}`}
                className={buttonVariants({
                  variant: mesActivo === item ? "default" : "outline",
                  size: "sm",
                })}
              >
                {etiquetaMes(item)}
              </Link>
            ))}
          </div>
          <a
            href={`/api/rendicion${consulta}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Exportar rendición
          </a>
        </section>

        {visibles.length === 0 ? (
          <section className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
            <h1 className="font-display text-2xl font-medium">Todavía no hay pagos</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Toma o adjunta la pantalla del pago. La app lee el monto y los folios, y los dejas confirmados si cuadran.
            </p>
            <Link href="/pagos/nuevo" className={`${buttonVariants({ size: "lg" })} mt-5`}>
              Capturar pago
            </Link>
          </section>
        ) : (
          <ul className="grid gap-3">
            {visibles.map((pago) => {
              const cuadre = cuadreDe(pago.monto, pago.documentos)
              return (
                <li key={pago.id}>
                  <Link
                    href={`/pagos/${pago.id}`}
                    className="block rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-accent/40"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">{formatFecha(pago.fecha)}</p>
                        <h2 className="font-display truncate text-xl font-medium">{pago.proveedor}</h2>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {[pago.descripcion, pago.tarjeta].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-xl font-medium tabular-nums">{formatCLP(pago.monto)}</p>
                        <div className="mt-2 flex justify-end">
                          <CuadreBadge cuadre={cuadre} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {pago.documentos.length === 0 ? (
                        <span className="text-sm text-muted-foreground">Sin folios todavía</span>
                      ) : (
                        pago.documentos.map((documento) => (
                          <span
                            key={documento.id}
                            className="rounded-full bg-secondary px-2.5 py-1 text-xs tabular-nums"
                          >
                            {etiquetaTipo(documento.tipo)} {documento.folio || "sin folio"} ·{" "}
                            {formatCLP(documento.monto)}
                          </span>
                        ))
                      )}
                      <span className="text-xs text-muted-foreground">
                        {pago.fotos.length === 0
                          ? "Sin captura"
                          : pago.fotos.length === 1
                            ? "1 captura"
                            : `${pago.fotos.length} capturas`}
                        {pago.ejemplo ? " · Ejemplo" : ""}
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </>
  )
}
