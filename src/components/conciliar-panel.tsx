"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatCLP, formatFecha } from "@/lib/format"
import { conciliar, leerCartola, leerRendicion, tsvSalida, type PagoRendicion } from "@/lib/conciliar"

const ETIQUETA_MOTIVO: Record<string, string> = {
  exacta: "Fecha y monto",
  monto: "Solo el monto",
  manual: "Elegido por ti",
  sin_pago: "Sin pago en la app",
}

function etiquetaPago(pago: PagoRendicion): string {
  const partes = [formatFecha(pago.fecha), pago.proveedor.trim() || "Sin proveedor", formatCLP(pago.monto)]
  if (pago.folio) partes.push(pago.folio)
  return partes.join(" · ")
}

export function ConciliarPanel() {
  const [cartolaTexto, setCartolaTexto] = useState("")
  const [csvTexto, setCsvTexto] = useState("")
  const [origenCsv, setOrigenCsv] = useState("")
  const [manual, setManual] = useState<Record<string, string>>({})
  const [copiado, setCopiado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const archivoRef = useRef<HTMLInputElement>(null)

  const cartola = useMemo(() => leerCartola(cartolaTexto), [cartolaTexto])
  const pagos = useMemo(() => leerRendicion(csvTexto), [csvTexto])
  const resultado = useMemo(() => conciliar(cartola.filas, pagos, manual), [cartola.filas, pagos, manual])

  const asignados = new Set(resultado.map((item) => item.pagoId).filter((id): id is string => id !== null))
  const sinUsar = pagos.filter((pago) => !asignados.has(pago.id))
  const conFolio = resultado.filter((item) => item.folio).length
  const columna = cartola.columnaCategoria

  function cambiarCartola(texto: string) {
    setCartolaTexto(texto)
    setManual({})
    setCopiado(false)
  }

  async function cargarArchivo(archivo: File | null) {
    if (!archivo) return
    try {
      const texto = await archivo.text()
      const leidos = leerRendicion(texto)
      if (leidos.length === 0) {
        setError("Ese archivo no tiene pagos que pueda leer. Usa el rendicion.csv que exporta la app.")
        return
      }
      setError(null)
      setCsvTexto(texto)
      setOrigenCsv(archivo.name)
      setManual({})
    } catch {
      setError("No pude abrir el archivo.")
    }
  }

  async function usarEsteEquipo() {
    try {
      const respuesta = await fetch("/api/rendicion")
      if (!respuesta.ok) throw new Error("sin datos")
      const texto = await respuesta.text()
      setError(null)
      setCsvTexto(texto)
      setOrigenCsv("pagos de este equipo")
      setManual({})
      if (archivoRef.current) archivoRef.current.value = ""
    } catch {
      setError("No pude leer los pagos de este equipo.")
    }
  }

  async function copiarColumnas() {
    const tsv = tsvSalida(resultado)
    try {
      await navigator.clipboard.writeText(tsv)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setError("El navegador no dejó copiar. Selecciona el texto de la tabla a mano.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="font-display text-lg font-medium">1. Pega la cartola del banco</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          En Excel selecciona desde la fila de títulos (FECHA, DESCRIPCION, MONTO…) hasta el último movimiento, copia y
          pega aquí. Nada sale de este computador.
        </p>
        <Textarea
          value={cartolaTexto}
          onChange={(evento) => cambiarCartola(evento.target.value)}
          placeholder={"FECHA\tDESCRIPCION\tTITULAR/ADICIONAL\tMONTO…"}
          spellCheck={false}
          className="mt-3 min-h-32 font-mono text-xs"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          {cartola.filas.length === 0
            ? "Todavía no hay movimientos."
            : `${cartola.filas.length} movimientos leídos.`}
        </p>
        {cartola.aviso ? <p className="mt-1 text-sm text-destructive">{cartola.aviso}</p> : null}
      </section>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="font-display text-lg font-medium">2. Trae los pagos de la app</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sube el <span className="font-medium">rendicion.csv</span> que exportas desde el teléfono, o usa los pagos
          guardados en este computador.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={archivoRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(evento) => void cargarArchivo(evento.target.files?.[0] ?? null)}
            className="text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-background file:px-2.5 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
          />
          <Button variant="outline" size="lg" onClick={() => void usarEsteEquipo()}>
            Usar los pagos de este equipo
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {pagos.length === 0
            ? "Todavía no hay pagos cargados."
            : `${pagos.length} pagos desde ${origenCsv}. ${pagos.filter((pago) => pago.folio).length} con folio.`}
        </p>
        {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
      </section>

      {resultado.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
          <h2 className="font-display text-xl font-medium">Aquí aparece el pareo</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Pega la cartola y carga los pagos. Cada movimiento queda con su CATEGORIA, su FOLIO en tu formato y una OBS
            cuando algo necesita revisión.
          </p>
        </section>
      ) : (
        <section className="rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-medium">3. Copia las tres columnas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {conFolio} de {resultado.length} movimientos quedaron con folio.
                {columna
                  ? ` Pega en la columna ${columna} (CATEGORIA) de la primera fila de datos.`
                  : " Pega en la celda CATEGORIA de la primera fila de datos."}
              </p>
            </div>
            <Button size="lg" onClick={() => void copiarColumnas()}>
              {copiado ? "Copiado" : "Copiar CATEGORIA, FOLIO y OBS"}
            </Button>
          </div>
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full min-w-3xl text-sm">
              <thead className="bg-secondary/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Descripción</th>
                  <th className="px-3 py-2 text-right font-medium">Monto</th>
                  <th className="px-3 py-2 font-medium">Pago de la app</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 font-medium">Folio</th>
                  <th className="px-3 py-2 font-medium">Obs</th>
                </tr>
              </thead>
              <tbody>
                {resultado.map((item) => (
                  <tr key={item.fila.clave} className="border-t border-border/60 align-top">
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {item.fila.fecha ? formatFecha(item.fila.fecha) : item.fila.fechaTexto}
                    </td>
                    <td className="max-w-64 px-3 py-2">{item.fila.descripcion || "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                      {formatCLP(item.fila.monto)}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={item.pagoId ?? ""}
                        onChange={(evento) =>
                          setManual((actual) => ({ ...actual, [item.fila.clave]: evento.target.value }))
                        }
                        className="w-full max-w-64 rounded-lg border border-input bg-background px-2 py-1 text-sm"
                      >
                        <option value="">Sin pago</option>
                        {pagos.map((pago) => (
                          <option
                            key={pago.id}
                            value={pago.id}
                            disabled={pago.id !== item.pagoId && asignados.has(pago.id)}
                          >
                            {etiquetaPago(pago)}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-muted-foreground">{ETIQUETA_MOTIVO[item.motivo]}</p>
                    </td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{item.categoria || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{item.folio || "—"}</td>
                    <td className="max-w-48 px-3 py-2 text-xs text-muted-foreground">{item.obs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {sinUsar.length > 0 ? (
        <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="font-display text-lg font-medium">Pagos de la app sin movimiento en la cartola</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O el cargo llega en la próxima cartola, o el monto no es el mismo. Puedes asignarlos a mano en la tabla.
          </p>
          <ul className="mt-3 grid gap-2">
            {sinUsar.map((pago) => (
              <li key={pago.id} className="rounded-lg bg-secondary/40 px-3 py-2 text-sm">
                {etiquetaPago(pago)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
