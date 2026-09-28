import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

export function Encabezado({ accion = true }: { accion?: boolean }) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="min-w-0">
          <span className="font-display block text-2xl leading-none font-medium tracking-tight text-primary">
            Rendiciones
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">Pagos con tarjeta</span>
        </Link>
        {accion ? (
          <Link href="/pagos/nuevo" className={buttonVariants({ size: "lg" })}>
            Capturar pago
          </Link>
        ) : null}
      </div>
    </header>
  )
}
