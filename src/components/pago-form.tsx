"use client"

import { useActionState, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PanelCuadre } from "@/components/cuadre-badge"
import { guardarPago, type FormState } from "@/lib/actions"
import { formatMontoInput, parseCLP } from "@/lib/format"
import type { Pago, TipoDocumento } from "@/lib/types"
import { cn } from "cn"

type BorradorDocumento = {
  key: string
  folio: string
  fecha: string
  monto: string
  tipo: TipoDocumento
}

const estadoInicial: FormState = {}

function documentosIniciales(pago?: Pago): BorradorDocumento[] {
  if (!pago || pago.documentos.length === 0) {
    return [{ key: "nuevo-1", folio: "", fecha: "", monto: "", tipo: "factura" }]
  }
  return pago.documentos.map((documento) => ({
    key: documento.id,
    folio: documento.folio,
    fecha: documento.fecha,
    monto: documento.monto ? formatMontoInput(documento.monto) : "",
    tipo: documento.tipo,
  }))
}

export function PagoForm({
  pago,
  tarjetas,
  fechaInicial,
}: {
  pago?: Pago
  tarjetas: string[]
  fechaInicial: string
}) {
  const [estado, accion, pendiente] = useActionState(guardarPago, estadoInicial)
  const [fecha, setFecha] = useState(pago?.fecha ?? fechaInicial)
  const [proveedor, setProveedor] = useState(pago?.proveedor ?? "")
  const [descripcion, setDescripcion] = useState(pago?.descripcion ?? "")
  const [monto, setMonto] = useState(pago ? formatMontoInput(pago.monto) : "")
  const [tarjeta, setTarjeta] = useState(pago?.tarjeta ?? "")
  const [documentos, setDocumentos] = useState<BorradorDocumento[]>(() => documentosIniciales(pago))
  const [archivos, setArchivos] = useState<File[]>([])
  const [soltando, setSoltando] = useState(false)
  const inputFotos = useRef<HTMLInputElement>(null)

  const vistas = useMemo(
    () => archivos.map((archivo) => ({ nombre: archivo.name, url: URL.createObjectURL(archivo) })),
    [archivos],
  )

  function sincronizarFotos(files: File[]) {
    const siguientes = files.slice(0, 8)
    setArchivos(siguientes)
    if (!inputFotos.current) return
    const transferencia = new DataTransfer()
    siguientes.forEach((archivo) => transferencia.items.add(archivo))
    inputFotos.current.files = transferencia.files
  }

  function actualizarDocumento(key: string, cambios: Partial<BorradorDocumento>) {
    setDocumentos((actuales) =>
      actuales.map((documento) => (documento.key === key ? { ...documento, ...cambios } : documento)),
    )
  }

  const documentosParaCuadre = documentos.map((documento) => ({
    folio: documento.folio,
    monto: parseCLP(documento.monto) ?? 0,
  }))

  return (
    <form action={accion} className="grid gap-6">
      {pago ? <input type="hidden" name="id" value={pago.id} /> : null}
      {estado.error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{estado.error}</p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="fecha">Fecha del pago</Label>
          <Input
            id="fecha"
            name="fecha"
            type="date"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
            className="h-10"
            required
            aria-invalid={Boolean(estado.fieldErrors?.fecha)}
          />
          {estado.fieldErrors?.fecha ? (
            <p className="text-sm text-destructive">{estado.fieldErrors.fecha}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tarjeta">Tarjeta</Label>
          <Input
            id="tarjeta"
            name="tarjeta"
            list="tarjetas-conocidas"
            value={tarjeta}
            onChange={(event) => setTarjeta(event.target.value)}
            placeholder="Visa empresa"
            className="h-10"
            required
            aria-invalid={Boolean(estado.fieldErrors?.tarjeta)}
          />
          <datalist id="tarjetas-conocidas">
            {tarjetas.map((nombre) => (
              <option key={nombre} value={nombre} />
            ))}
          </datalist>
          {estado.fieldErrors?.tarjeta ? (
            <p className="text-sm text-destructive">{estado.fieldErrors.tarjeta}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="proveedor">Proveedor</Label>
          <Input
            id="proveedor"
            name="proveedor"
            value={proveedor}
            onChange={(event) => setProveedor(event.target.value)}
            placeholder="Agrosuper, Gasco…"
            className="h-10"
            required
            aria-invalid={Boolean(estado.fieldErrors?.proveedor)}
          />
          {estado.fieldErrors?.proveedor ? (
            <p className="text-sm text-destructive">{estado.fieldErrors.proveedor}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="monto">Monto del cargo</Label>
          <Input
            id="monto"
            name="monto"
            inputMode="numeric"
            value={monto}
            onChange={(event) => setMonto(event.target.value)}
            onBlur={() => {
              const valor = parseCLP(monto)
              if (valor != null) setMonto(formatMontoInput(valor))
            }}
            placeholder="166.547"
            className="h-10 tabular-nums"
            required
            aria-invalid={Boolean(estado.fieldErrors?.monto)}
          />
          {estado.fieldErrors?.monto ? (
            <p className="text-sm text-destructive">{estado.fieldErrors.monto}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="descripcion">Descripción</Label>
          <Input
            id="descripcion"
            name="descripcion"
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            placeholder="Pago en línea, recarga granel…"
            className="h-10"
            aria-invalid={Boolean(estado.fieldErrors?.descripcion)}
          />
          {estado.fieldErrors?.descripcion ? (
            <p className="text-sm text-destructive">{estado.fieldErrors.descripcion}</p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="font-display text-xl font-medium">Captura de la pantalla</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            La foto que sacas al pagar. Puedes adjuntar más de una si el comprobante salió en varias pantallas.
          </p>
        </div>
        <div
          className={cn(
            "rounded-xl border border-dashed border-border bg-card px-4 py-5",
            soltando && "border-primary bg-primary/5",
          )}
          onDragOver={(event) => {
            event.preventDefault()
            setSoltando(true)
          }}
          onDragLeave={() => setSoltando(false)}
          onDrop={(event) => {
            event.preventDefault()
            setSoltando(false)
            const nuevas = Array.from(event.dataTransfer.files).filter((archivo) =>
              archivo.type.startsWith("image/"),
            )
            sincronizarFotos([...archivos, ...nuevas])
          }}
        >
          <input
            ref={inputFotos}
            name="fotos"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="sr-only"
            onChange={(event) => sincronizarFotos(Array.from(event.target.files ?? []))}
          />
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">JPG o PNG. También puedes soltar el archivo aquí.</p>
            <Button type="button" variant="outline" onClick={() => inputFotos.current?.click()}>
              Adjuntar captura
            </Button>
          </div>
          {vistas.length > 0 ? (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {vistas.map((vista, index) => (
                <li key={vista.url} className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={vista.url} alt="" className="aspect-[4/3] w-full object-cover" />
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <span className="truncate text-xs">{vista.nombre}</span>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => sincronizarFotos(archivos.filter((_, item) => item !== index))}
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {estado.fieldErrors?.fotos ? (
          <p className="text-sm text-destructive">{estado.fieldErrors.fotos}</p>
        ) : null}
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="font-display text-xl font-medium">Documentos del pago</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada factura o boleta va en su línea. En Agrosuper o Gasco, varias líneas suman el monto del cargo. Si el
            folio todavía no está, guarda el pago y complétalo después.
          </p>
        </div>
        <ul className="grid gap-3">
          {documentos.map((documento, index) => (
            <li key={documento.key} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Documento {index + 1}</p>
                {documentos.length > 1 ? (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() =>
                      setDocumentos((actuales) => actuales.filter((item) => item.key !== documento.key))
                    }
                  >
                    Quitar
                  </button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="grid gap-1.5">
                  <Label htmlFor={`tipo-${documento.key}`}>Tipo</Label>
                  <select
                    id={`tipo-${documento.key}`}
                    name="doc-tipo"
                    value={documento.tipo}
                    onChange={(event) =>
                      actualizarDocumento(documento.key, { tipo: event.target.value as TipoDocumento })
                    }
                    className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="factura">Factura</option>
                    <option value="boleta">Boleta</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`folio-${documento.key}`}>Folio</Label>
                  <Input
                    id={`folio-${documento.key}`}
                    name="doc-folio"
                    value={documento.folio}
                    onChange={(event) => actualizarDocumento(documento.key, { folio: event.target.value })}
                    placeholder="101070510"
                    className="h-10"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`fecha-doc-${documento.key}`}>Fecha del documento</Label>
                  <Input
                    id={`fecha-doc-${documento.key}`}
                    name="doc-fecha"
                    type="date"
                    value={documento.fecha}
                    onChange={(event) => actualizarDocumento(documento.key, { fecha: event.target.value })}
                    className="h-10"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`monto-doc-${documento.key}`}>Monto</Label>
                  <Input
                    id={`monto-doc-${documento.key}`}
                    name="doc-monto"
                    inputMode="numeric"
                    value={documento.monto}
                    onChange={(event) => actualizarDocumento(documento.key, { monto: event.target.value })}
                    onBlur={() => {
                      const valor = parseCLP(documento.monto)
                      if (valor != null) actualizarDocumento(documento.key, { monto: formatMontoInput(valor) })
                    }}
                    placeholder="53.480"
                    className="h-10 tabular-nums"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setDocumentos((actuales) => [
                ...actuales,
                { key: crypto.randomUUID(), folio: "", fecha: "", monto: "", tipo: "factura" },
              ])
            }
          >
            Agregar documento
          </Button>
        </div>
        {estado.fieldErrors?.documentos ? (
          <p className="text-sm text-destructive">{estado.fieldErrors.documentos}</p>
        ) : null}
      </section>

      <PanelCuadre monto={parseCLP(monto) ?? 0} documentos={documentosParaCuadre} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href={pago ? `/pagos/${pago.id}` : "/"}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Cancelar
        </Link>
        <Button type="submit" size="lg" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar pago"}
        </Button>
      </div>
    </form>
  )
}
