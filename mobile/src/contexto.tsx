import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { actualizarPago, crearPago, eliminarPago, leerPagos, type PagoInput } from "./datos"
import type { Pago } from "./types"

type ContextoPagos = {
  pagos: Pago[]
  cargando: boolean
  error: string | null
  guardar: (id: string | null, input: PagoInput) => Promise<Pago>
  borrar: (id: string) => Promise<void>
}

const Contexto = createContext<ContextoPagos | null>(null)

export function PagosProvider({ children }: { children: ReactNode }) {
  const [pagos, setPagos] = useState<Pago[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    leerPagos()
      .then((lista) => {
        if (activo) setPagos(lista)
      })
      .catch(() => {
        if (activo) setError("No se pudieron leer los pagos guardados en el teléfono.")
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [])

  const valor = useMemo<ContextoPagos>(
    () => ({
      pagos,
      cargando,
      error,
      async guardar(id, input) {
        const pago = id ? await actualizarPago(id, input) : await crearPago(input)
        const lista = await leerPagos()
        setPagos(lista)
        return pago
      },
      async borrar(id) {
        await eliminarPago(id)
        setPagos(await leerPagos())
      },
    }),
    [pagos, cargando, error],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function usePagos() {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error("usePagos debe usarse dentro de PagosProvider")
  return contexto
}
