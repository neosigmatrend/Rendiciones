import Link from "next/link"
import { Encabezado } from "@/components/encabezado"
import { buttonVariants } from "@/components/ui/button"

export default function NoEncontrado() {
  return (
    <>
      <Encabezado />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start gap-3 px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl font-medium">Ese pago no está</h1>
        <p className="text-sm text-muted-foreground">Puede haberse eliminado o el enlace está incompleto.</p>
        <Link href="/" className={buttonVariants()}>
          Volver a los pagos
        </Link>
      </main>
    </>
  )
}
