import { leerFoto } from "@/lib/store"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const foto = await leerFoto(id)
  if (!foto) return new Response("No encontrada", { status: 404 })

  return new Response(new Uint8Array(foto.buffer), {
    headers: {
      "Content-Type": foto.tipo,
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="${foto.nombre.replace(/"/g, "")}"`,
    },
  })
}
