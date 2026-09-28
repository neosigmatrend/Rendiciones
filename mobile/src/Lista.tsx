import { useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import * as Sharing from "expo-sharing"
import { File, Paths } from "expo-file-system"
import { usePagos } from "./contexto"
import { cuadreDe, etiquetaCuadre, etiquetaMes, etiquetaTipo, formatCLP, formatFecha, mesDeFecha } from "./format"
import type { Pago } from "./types"
import { Boton, MarcaCuadre, colores } from "./ui"

export function Lista({ onAbrir, onNuevo }: { onAbrir: (id: string) => void; onNuevo: () => void }) {
  const { pagos, cargando, error } = usePagos()
  const meses = [...new Set(pagos.map((pago) => mesDeFecha(pago.fecha)))].sort().reverse()
  const [mes, setMes] = useState<string | null>(null)
  const visibles = mes ? pagos.filter((pago) => mesDeFecha(pago.fecha) === mes) : pagos
  const total = visibles.reduce((suma, pago) => suma + pago.monto, 0)
  const cuadrados = visibles.filter((pago) => cuadreDe(pago.monto, pago.documentos).estado === "cuadra").length

  if (cargando) {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator color={colores.primario} />
        <Text style={estilos.ayuda}>Cargando pagos…</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={estilos.centrado}>
        <Text style={estilos.titulo}>No se pudieron cargar</Text>
        <Text style={estilos.ayuda}>{error}</Text>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={estilos.marca}>Rendiciones</Text>
      <Text style={estilos.version}>versión 7</Text>
      <Text style={estilos.subtitulo}>Pagos con tarjeta</Text>
      <View style={estilos.resumen}>
        <Resumen etiqueta="Pagos" valor={String(visibles.length)} />
        <Resumen etiqueta="En tarjeta" valor={formatCLP(total)} />
        <Resumen etiqueta="Cuadrados" valor={`${cuadrados}/${visibles.length}`} />
      </View>
      <Boton titulo="Capturar pago" onPress={onNuevo} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.meses}>
        <Filtro titulo="Todos" activo={mes === null} onPress={() => setMes(null)} />
        {meses.map((item) => (
          <Filtro key={item} titulo={etiquetaMes(item)} activo={mes === item} onPress={() => setMes(item)} />
        ))}
      </ScrollView>
      <Boton titulo="Exportar rendición" variante="secundario" onPress={() => exportar(visibles, mes)} />
      {visibles.length === 0 ? (
        <View style={estilos.vacio}>
          <Text style={estilos.titulo}>Todavía no hay pagos</Text>
          <Text style={estilos.ayuda}>
            Toma o adjunta la pantalla del pago. La app lee el monto y los folios, y los dejas confirmados si cuadran.
          </Text>
        </View>
      ) : (
        visibles.map((pago) => {
          const cuadre = cuadreDe(pago.monto, pago.documentos)
          return (
            <Pressable key={pago.id} onPress={() => onAbrir(pago.id)} style={estilos.pago}>
              <View style={estilos.pagoCabeza}>
                <View style={estilos.flex}>
                  <Text style={estilos.fecha}>{formatFecha(pago.fecha)}</Text>
                  <Text style={[estilos.proveedor, !pago.proveedor.trim() && estilos.proveedorVacio]}>
                    {pago.proveedor.trim() || "Sin proveedor"}
                  </Text>
                  <Text style={estilos.ayuda} numberOfLines={1}>
                    {[pago.descripcion, pago.tarjeta].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <Text style={estilos.monto}>{formatCLP(pago.monto)}</Text>
              </View>
              <MarcaCuadre cuadre={cuadre} />
              <Text style={estilos.lineas}>
                {pago.documentos.length === 0
                  ? "Sin folios todavía"
                  : pago.documentos
                      .map((documento) => `${etiquetaTipo(documento.tipo)} ${documento.folio || "sin folio"} · ${formatCLP(documento.monto)}`)
                      .join("\n")}
              </Text>
              <Text style={estilos.meta}>
                {pago.fotos.length === 0 ? "Sin captura" : pago.fotos.length === 1 ? "1 captura" : `${pago.fotos.length} capturas`}
                {pago.ejemplo ? " · Ejemplo" : ""}
              </Text>
            </Pressable>
          )
        })
      )}
    </ScrollView>
  )
}

function Resumen({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={estilos.resumenItem}>
      <Text style={estilos.resumenEtiqueta}>{etiqueta}</Text>
      <Text style={estilos.resumenValor}>{valor}</Text>
    </View>
  )
}

function Filtro({ titulo, activo, onPress }: { titulo: string; activo: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[estilos.filtro, activo && estilos.filtroActivo]}>
      <Text style={[estilos.filtroTexto, activo && estilos.filtroTextoActivo]}>{titulo}</Text>
    </Pressable>
  )
}

function celda(valor: string | number) {
  const texto = String(valor)
  if (/[";\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`
  return texto
}

async function exportar(pagos: Pago[], mes: string | null) {
  const encabezado = ["fecha", "proveedor", "descripcion", "tarjeta", "monto_pago", "folio", "tipo", "fecha_documento", "monto_documento", "estado", "ejemplo"]
  const filas = pagos.flatMap((pago) => {
    const cuadre = cuadreDe(pago.monto, pago.documentos)
    const estado = etiquetaCuadre(cuadre)
    const ejemplo = pago.ejemplo ? "si" : "no"
    if (pago.documentos.length === 0) {
      return [[pago.fecha, pago.proveedor, pago.descripcion, pago.tarjeta, pago.monto, "", "", "", "", estado, ejemplo]]
    }
    return pago.documentos.map((documento) => [
      pago.fecha,
      pago.proveedor,
      pago.descripcion,
      pago.tarjeta,
      pago.monto,
      documento.folio,
      documento.tipo,
      documento.fecha,
      documento.monto,
      estado,
      ejemplo,
    ])
  })
  const csv = `\uFEFF${[encabezado, ...filas].map((fila) => fila.map(celda).join(";")).join("\n")}\n`
  const nombre = mes ? `rendicion-${mes}.csv` : "rendicion.csv"
  const archivo = new File(Paths.cache, nombre)
  if (!archivo.exists) archivo.create()
  archivo.write(csv)
  const disponible = await Sharing.isAvailableAsync()
  if (!disponible) return
  await Sharing.shareAsync(archivo.uri, { mimeType: "text/csv", dialogTitle: "Rendición", UTI: "public.comma-separated-values-text" })
}

const estilos = StyleSheet.create({
  contenido: { gap: 12, padding: 16, paddingBottom: 40 },
  centrado: { alignItems: "center", flex: 1, gap: 8, justifyContent: "center", padding: 24 },
  marca: { color: colores.primario, fontSize: 32, fontWeight: "700" },
  version: { color: colores.primario, fontSize: 22, fontWeight: "700", marginTop: -6 },
  subtitulo: { color: colores.muted, fontSize: 15, marginTop: -4 },
  titulo: { color: colores.tinta, fontSize: 24, fontWeight: "700" },
  ayuda: { color: colores.muted, fontSize: 14, lineHeight: 20 },
  resumen: { flexDirection: "row", gap: 8 },
  resumenItem: { backgroundColor: colores.tarjeta, borderRadius: 14, flex: 1, padding: 10 },
  resumenEtiqueta: { color: colores.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  resumenValor: { color: colores.tinta, fontSize: 16, fontWeight: "700", marginTop: 4 },
  meses: { gap: 8 },
  filtro: { backgroundColor: colores.tarjeta, borderColor: colores.borde, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  filtroActivo: { backgroundColor: colores.primario, borderColor: colores.primario },
  filtroTexto: { color: colores.tinta, fontSize: 14, fontWeight: "600" },
  filtroTextoActivo: { color: colores.primarioTexto },
  vacio: { gap: 8, paddingVertical: 12 },
  pago: { backgroundColor: colores.tarjeta, borderRadius: 16, gap: 8, padding: 14 },
  pagoCabeza: { flexDirection: "row", gap: 12, justifyContent: "space-between" },
  flex: { flex: 1 },
  fecha: { color: colores.muted, fontSize: 13 },
  proveedor: { color: colores.tinta, fontSize: 20, fontWeight: "700" },
  proveedorVacio: { color: colores.muted },
  monto: { color: colores.tinta, fontSize: 18, fontWeight: "700" },
  lineas: { color: colores.tinta, fontSize: 13, lineHeight: 18 },
  meta: { color: colores.muted, fontSize: 12 },
})
