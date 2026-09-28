"use client"

import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PanelCuadre } from "@/components/cuadre-badge"
import { guardarPago, type FormState } from "@/lib/actions"
import { cuadreDe, etiquetaTipo, formatCLP, formatFecha, formatMontoInput, parseCLP } from "@/lib/format"
import { combinarLecturas, type DocumentoLeido, type Lectura } from "@/lib/leerDocumento"
import type { TipoDocumento } from "@/lib/types"

type Borrador = {
  key: string
  folio: string
  fecha: string
  monto: string
  tipo: TipoDocumento
}

type Paso = "capturar" | "leyendo" | "confirmar"

const estadoInicial: FormState = {}

function borradorLeido(documento: DocumentoLeido, indice: number): Borrador {
  return {
    key: `leido-${documento.folio}-${indice}`,
    folio: documento.folio,
    fecha: documento.fecha,
    monto: formatMontoInput(documento.monto),
    tipo: documento.tipo,
  }
}

function mensajeFallo(motivo: string) {
  if (motivo === "sin_datos") return "No encontré el monto ni los folios en la captura."
  return "No pude leer la captura. Revisa que haya internet."
}

function mensajeLectura(lectura: Lectura) {
  const estado = cuadreDe(lectura.monto ?? 0, lectura.documentos).estado
  if (lectura.monto == null) return "No encontré el monto en la captura."
  if (estado === "cuadra") {
    return lectura.documentos.length === 1
      ? "Leí 1 folio y suma el monto. Confírmalo."
      : `Leí ${lectura.documentos.length} folios y suman el monto. Confírmalos.`
  }
  if (estado === "sin_documentos") return "Leí el monto. Esta captura no trae folios."
  return "Los montos leídos no cuadran. Corrígelos antes de confirmar."
}

export function CapturaPago({ tarjetas, fechaInicial }: { tarjetas: string[]; fechaInicial: string }) {
  const [estado, accion, pendiente] = useActionState(guardarPago, estadoInicial)
  const [paso, setPaso] = useState<Paso>("capturar")
  const [fecha, setFecha] = useState(fechaInicial)
  const [proveedor, setProveedor] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [monto, setMonto] = useState("")
  const [tarjeta, setTarjeta] = useState(tarjetas[0] ?? "")
  const [documentos, setDocumentos] = useState<Borrador[]>([])
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [fallo, setFallo] = useState(false)
  const [archivos, setArchivos] = useState<File[]>([])
  const inputFotos = useRef<HTMLInputElement>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)
  const inputCamara = useRef<HTMLInputElement>(null)

  const vistas = useMemo(
    () => archivos.map((archivo) => ({ nombre: archivo.name, url: URL.createObjectURL(archivo) })),
    [archivos],
  )

  useEffect(() => {
    if (!inputFotos.current) return
    const transferencia = new DataTransfer()
    archivos.forEach((archivo) => transferencia.items.add(archivo))
    inputFotos.current.files = transferencia.files
  }, [archivos, paso])

  function sincronizarFotos(files: File[]) {
    const siguientes = files.slice(0, 8)
    setArchivos(siguientes)
    if (!inputFotos.current) return
    const transferencia = new DataTransfer()
    siguientes.forEach((archivo) => transferencia.items.add(archivo))
    inputFotos.current.files = transferencia.files
  }

  function aplicarLectura(lectura: Lectura) {
    if (lectura.proveedor) setProveedor(lectura.proveedor)
    if (lectura.fecha) setFecha(lectura.fecha)
    if (lectura.descripcion) setDescripcion(lectura.descripcion)
    if (lectura.monto != null) setMonto(formatMontoInput(lectura.monto))
    if (lectura.documentos.length > 0) {
      setDocumentos(lectura.documentos.map((documento, indice) => borradorLeido(documento, indice)))
    }
    const estadoCuadre = cuadreDe(lectura.monto ?? 0, lectura.documentos).estado
    setCorrigiendo(!lectura.proveedor || lectura.monto == null || estadoCuadre === "falta" || estadoCuadre === "sobra")
    setFallo(lectura.monto == null)
    setAviso(mensajeLectura(lectura))
  }

  async function leerCapturas(nuevas: File[]) {
    const siguientes = [...archivos, ...nuevas].slice(0, 8)
    sincronizarFotos(siguientes)
    setPaso("leyendo")
    setFallo(false)
    setAviso(null)
    const lecturas: Lectura[] = []
    let motivo = "servicio"
    try {
      for (const archivo of nuevas) {
        const cuerpo = new FormData()
        cuerpo.append("foto", archivo)
        const respuesta = await fetch("/api/leer", { method: "POST", body: cuerpo })
        const datos = (await respuesta.json()) as { ok: boolean; motivo?: string; lectura?: Lectura }
        if (datos.ok && datos.lectura) lecturas.push(datos.lectura)
        else if (datos.motivo) motivo = datos.motivo
      }
      if (lecturas.length === 0) {
        setFallo(true)
        setCorrigiendo(true)
        setAviso(mensajeFallo(motivo))
      } else {
        aplicarLectura(combinarLecturas(lecturas))
      }
    } catch {
      setFallo(true)
      setCorrigiendo(true)
      setAviso(mensajeFallo("sin_red"))
    } finally {
      setPaso("confirmar")
    }
  }

  const documentosParaCuadre = documentos.map((documento) => ({
    folio: documento.folio,
    monto: parseCLP(documento.monto) ?? 0,
  }))
  const cuadre = cuadreDe(parseCLP(monto) ?? 0, documentosParaCuadre)
  const puedeConfirmar = cuadre.estado === "cuadra" || cuadre.estado === "sin_documentos"

  const entradas = (
    <>
      <input
        ref={inputCamara}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const archivosElegidos = Array.from(event.target.files ?? [])
          event.target.value = ""
          if (archivosElegidos.length > 0) void leerCapturas(archivosElegidos)
        }}
      />
      <input
        ref={inputArchivo}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => {
          const archivosElegidos = Array.from(event.target.files ?? [])
          event.target.value = ""
          if (archivosElegidos.length > 0) void leerCapturas(archivosElegidos)
        }}
      />
    </>
  )

  if (paso === "capturar") {
    return (
      <div className="grid gap-4">
        {entradas}
        <p className="text-sm text-muted-foreground">
          Toma o adjunta la pantalla del pago. La app lee el monto y los folios, comprueba que sumen el cargo y te pide
          confirmar.
        </p>
        <p className="text-sm text-muted-foreground">Hace falta internet: la captura se envía a OCR.space para leerla.</p>
        <div className="flex flex-col gap-2">
          <Button type="button" size="lg" onClick={() => inputCamara.current?.click()}>
            Tomar foto
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={() => inputArchivo.current?.click()}>
            Adjuntar captura
          </Button>
          <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Cancelar
          </Link>
        </div>
      </div>
    )
  }

  if (paso === "leyendo") {
    return (
      <div className="grid justify-items-center gap-4 py-8">
        {entradas}
        {vistas[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vistas[vistas.length - 1]?.url} alt="" className="max-h-72 w-full rounded-xl object-contain" />
        ) : null}
        <p className="font-display text-xl font-medium">Leyendo monto y folios…</p>
      </div>
    )
  }

  return (
    <form action={accion} className="grid gap-6">
      {entradas}
      <input ref={inputFotos} name="fotos" type="file" accept="image/*" multiple className="sr-only" />
      {estado.error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{estado.error}</p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {puedeConfirmar
          ? "Esto es lo que leí en la captura. Si está bien, confirma."
          : "Los folios no suman el monto. Corrige lo que esté mal y después confirma."}
      </p>
      {aviso ? <p className={fallo ? "text-sm text-amber-900" : "text-sm"}>{aviso}</p> : null}
      {vistas.length > 0 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={vistas[vistas.length - 1]?.url} alt="" className="max-h-72 w-full rounded-xl object-contain bg-muted" />
      ) : null}

      <CampoLectura etiqueta="Proveedor" valor={proveedor} vacio="Sin proveedor" editable={corrigiendo || !proveedor.trim()}>
        <Input name="proveedor" value={proveedor} onChange={(event) => setProveedor(event.target.value)} className="h-10" required />
      </CampoLectura>
      {!corrigiendo && proveedor.trim() ? <input type="hidden" name="proveedor" value={proveedor} /> : null}

      <CampoLectura etiqueta="Fecha" valor={formatFecha(fecha)} editable={corrigiendo}>
        <Input name="fecha" type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} className="h-10" required />
      </CampoLectura>
      {!corrigiendo ? <input type="hidden" name="fecha" value={fecha} /> : null}

      <CampoLectura
        etiqueta="Monto del cargo"
        valor={parseCLP(monto) != null ? formatCLP(parseCLP(monto) ?? 0) : ""}
        vacio="Sin monto"
        editable={corrigiendo || !(parseCLP(monto) ?? 0)}
      >
        <Input
          name="monto"
          inputMode="numeric"
          value={monto}
          onChange={(event) => setMonto(event.target.value)}
          onBlur={() => {
            const valor = parseCLP(monto)
            if (valor != null) setMonto(formatMontoInput(valor))
          }}
          className="h-10 tabular-nums"
          required
        />
      </CampoLectura>
      {!corrigiendo && (parseCLP(monto) ?? 0) > 0 ? <input type="hidden" name="monto" value={monto} /> : null}

      {descripcion || corrigiendo ? (
        <CampoLectura etiqueta="Descripción" valor={descripcion} vacio="Sin descripción" editable={corrigiendo}>
          <Input name="descripcion" value={descripcion} onChange={(event) => setDescripcion(event.target.value)} className="h-10" />
        </CampoLectura>
      ) : null}
      {!corrigiendo && descripcion ? <input type="hidden" name="descripcion" value={descripcion} /> : null}
      {!descripcion && !corrigiendo ? <input type="hidden" name="descripcion" value="" /> : null}

      <section className="grid gap-3">
        <h2 className="font-display text-xl font-medium">Folios</h2>
        {documentos.length === 0 ? <p className="text-sm text-muted-foreground">Esta captura no trae folios.</p> : null}
        <ul className="grid gap-3">
          {documentos.map((documento, indice) => (
            <li key={documento.key} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              {corrigiendo ? (
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="grid gap-1.5">
                    <Label>Tipo</Label>
                    <select
                      name="doc-tipo"
                      value={documento.tipo}
                      onChange={(event) =>
                        setDocumentos((actuales) =>
                          actuales.map((item) =>
                            item.key === documento.key ? { ...item, tipo: event.target.value as TipoDocumento } : item,
                          ),
                        )
                      }
                      className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    >
                      <option value="factura">Factura</option>
                      <option value="boleta">Boleta</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Folio</Label>
                    <Input
                      name="doc-folio"
                      value={documento.folio}
                      onChange={(event) =>
                        setDocumentos((actuales) =>
                          actuales.map((item) =>
                            item.key === documento.key ? { ...item, folio: event.target.value } : item,
                          ),
                        )
                      }
                      className="h-10"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Fecha</Label>
                    <Input
                      name="doc-fecha"
                      type="date"
                      value={documento.fecha}
                      onChange={(event) =>
                        setDocumentos((actuales) =>
                          actuales.map((item) =>
                            item.key === documento.key ? { ...item, fecha: event.target.value } : item,
                          ),
                        )
                      }
                      className="h-10"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Monto</Label>
                    <Input
                      name="doc-monto"
                      inputMode="numeric"
                      value={documento.monto}
                      onChange={(event) =>
                        setDocumentos((actuales) =>
                          actuales.map((item) =>
                            item.key === documento.key ? { ...item, monto: event.target.value } : item,
                          ),
                        )
                      }
                      className="h-10 tabular-nums"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <input type="hidden" name="doc-tipo" value={documento.tipo} />
                  <input type="hidden" name="doc-folio" value={documento.folio} />
                  <input type="hidden" name="doc-fecha" value={documento.fecha} />
                  <input type="hidden" name="doc-monto" value={documento.monto} />
                  <p className="font-medium">
                    {etiquetaTipo(documento.tipo)} {documento.folio || "sin folio"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(documento.fecha ? formatFecha(documento.fecha) : "Sin fecha") +
                      " · " +
                      formatCLP(parseCLP(documento.monto) ?? 0)}
                  </p>
                </>
              )}
              {corrigiendo ? (
                <button
                  type="button"
                  className="mt-3 text-sm text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => setDocumentos((actuales) => actuales.filter((item) => item.key !== documento.key))}
                >
                  Quitar folio {indice + 1}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {corrigiendo ? (
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
            Agregar folio
          </Button>
        ) : null}
      </section>

      <PanelCuadre monto={parseCLP(monto) ?? 0} documentos={documentosParaCuadre} />

      <div className="grid gap-1.5">
        <Label htmlFor="tarjeta">Tarjeta</Label>
        {tarjetas.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tarjetas.map((nombre) => (
              <button
                key={nombre}
                type="button"
                onClick={() => setTarjeta(nombre)}
                className={buttonVariants({ variant: tarjeta === nombre ? "default" : "outline", size: "sm" })}
              >
                {nombre}
              </button>
            ))}
          </div>
        ) : null}
        {corrigiendo || !tarjeta.trim() || !tarjetas.includes(tarjeta) ? (
          <Input
            id="tarjeta"
            name="tarjeta"
            value={tarjeta}
            onChange={(event) => setTarjeta(event.target.value)}
            placeholder="Visa empresa"
            className="h-10"
            required
          />
        ) : (
          <input type="hidden" name="tarjeta" value={tarjeta} />
        )}
        {estado.fieldErrors?.tarjeta ? <p className="text-sm text-destructive">{estado.fieldErrors.tarjeta}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Button type="button" variant="outline" onClick={() => setCorrigiendo((actual) => !actual)}>
          {corrigiendo ? "Ver lectura" : "Corregir"}
        </Button>
        <Button type="button" variant="outline" onClick={() => inputArchivo.current?.click()}>
          Otra captura
        </Button>
        <Button type="submit" size="lg" disabled={pendiente || !puedeConfirmar}>
          {pendiente ? "Guardando…" : "Confirmar pago"}
        </Button>
        {!puedeConfirmar ? (
          <button type="submit" className="text-sm text-muted-foreground underline-offset-2 hover:underline" disabled={pendiente}>
            Confirmar aunque no cuadre
          </button>
        ) : null}
        <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Cancelar
        </Link>
      </div>
    </form>
  )
}

function CampoLectura({
  etiqueta,
  valor,
  vacio = "",
  editable,
  children,
}: {
  etiqueta: string
  valor: string
  vacio?: string
  editable: boolean
  children: React.ReactNode
}) {
  if (editable) {
    return (
      <div className="grid gap-1.5">
        <Label>{etiqueta}</Label>
        {children}
      </div>
    )
  }
  return (
    <div>
      <p className="text-sm font-medium">{etiqueta}</p>
      <p className="font-display text-2xl font-medium">{valor.trim() || vacio}</p>
    </div>
  )
}
