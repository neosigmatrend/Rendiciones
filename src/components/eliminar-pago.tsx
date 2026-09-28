"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { eliminarPagoAction } from "@/lib/actions"

export function EliminarPago({ id, proveedor }: { id: string; proveedor: string }) {
  const [abierto, setAbierto] = useState(false)
  const [pendiente, iniciar] = useTransition()

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button variant="destructive" />}>Eliminar</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar este pago</DialogTitle>
          <DialogDescription>
            Se borra el pago de {proveedor}, sus documentos y las capturas guardadas.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={pendiente}
            onClick={() => iniciar(() => eliminarPagoAction(id))}
          >
            {pendiente ? "Eliminando…" : "Eliminar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
