"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { quitarFotoAction } from "@/lib/actions"
import type { Foto } from "@/lib/types"

export function FotoGaleria({
  fotos,
  pagoId,
  permitirQuitar = false,
}: {
  fotos: Foto[]
  pagoId: string
  permitirQuitar?: boolean
}) {
  const [abierta, setAbierta] = useState<Foto | null>(null)

  if (fotos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
        Este pago todavía no tiene captura. Puedes adjuntarla al editarlo.
      </p>
    )
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {fotos.map((foto) => (
          <li key={foto.id} className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            <button type="button" className="block w-full" onClick={() => setAbierta(foto)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/fotos/${foto.id}`}
                alt={foto.nombre}
                className="aspect-[4/3] w-full object-cover"
              />
            </button>
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="truncate text-xs">{foto.nombre}</span>
              {permitirQuitar ? (
                <form action={quitarFotoAction}>
                  <input type="hidden" name="pagoId" value={pagoId} />
                  <input type="hidden" name="fotoId" value={foto.id} />
                  <Button type="submit" variant="ghost" size="xs">
                    Quitar
                  </Button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <Dialog open={abierta !== null} onOpenChange={(abierto) => !abierto && setAbierta(null)}>
        <DialogContent className="sm:max-w-4xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>{abierta?.nombre ?? "Captura"}</DialogTitle>
            <DialogDescription>Captura guardada con este pago.</DialogDescription>
          </DialogHeader>
          {abierta ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/fotos/${abierta.id}`}
              alt={abierta.nombre}
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
