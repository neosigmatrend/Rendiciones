import { useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import * as Sharing from "expo-sharing"
import { File, Paths } from "expo-file-system"
import { usePagos } from "./contexto"
import type { ModoNuevo } from "./Formulario"
import { cuadreDe, etiquetaCuadre, etiquetaMes, etiquetaTipo, folioBanco, formatCLP, formatFecha, mesDeFecha } from "./format"
import type { Pago } from "./types"
import { Boton, colores } from "./ui"

type FiltroTipo = "todos" | "rendicion" | "no"

export function Lista({ onAbrir, onNuevo }: { onAbrir: (id: string) => void; onNuevo: (modo: ModoNuevo) => void }) {
  const { pagos, cargando, error } = usePagos()
  const meses = [...new Set(pagos.map((pago) => mesDeFecha(pago.fecha)))].sort().reverse()
  const [mes, setMes] = useState<string | null>(null)
  const [tipo, setTipo] = useState<FiltroTipo>("todos")
  const delMes = mes ? pagos.filter((pago) => mesDeFecha(pago.fecha) === mes) : pagos
  const visibles = delMes.filter((pago) => tipo === "todos" || (tipo === "rendicion") === pago.esRendicion)
  const total = delMes.reduce((suma, pago) => suma + pago.monto, 0)
  const rendiciones = delMes.filter((pago) => pago.esRendicion)
  const conDocumentos = rendiciones.filter((pago) => pago.documentos.length > 0).length
  const sinRendicion = delMes.length - rendiciones.length

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
      <Text style={estilos.version}>versión 19</Text>
      <Text style={estilos.subtitulo}>Pagos con tarjeta</Text>
      <View style={estilos.resumen}>
        <Resumen etiqueta="Pagos" valor={String(delMes.length)} />
        <Resumen etiqueta="En tarjeta" valor={formatCLP(total)} />
        <Resumen etiqueta="Con folio" valor={`${conDocumentos}/${rendiciones.length}`} />
        <Resumen etiqueta="No rend." valor={String(sinRendicion)} />
      </View>
      <Boton titulo="Capturar rendición" onPress={() => onNuevo("rendicion")} />
      <Boton titulo="Compra sin rendición" variante="secundario" onPress={() => onNuevo("sin_rendicion")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.meses}>
        <Filtro titulo="Todos" activo={mes === null} onPress={() => setMes(null)} />
        {meses.map((item) => (
          <Filtro key={item} titulo={etiquetaMes(item)} activo={mes === item} onPress={() => setMes(item)} />
        ))}
      </ScrollView>
      <View style={estilos.meses}>
        <Filtro titulo="Todas" activo={tipo === "todos"} onPress={() => setTipo("todos")} />
        <Filtro titulo="Rendiciones" activo={tipo === "rendicion"} onPress={() => setTipo("rendicion")} />
        <Filtro titulo="No rendición" activo={tipo === "no"} onPress={() => setTipo("no")} />
      </View>
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
          return (
            <Pressable
              key={pago.id}
              onPress={() => onAbrir(pago.id)}
              style={[estilos.pago, { borderLeftColor: pago.esRendicion ? colores.primario : colores.sinRendicion }]}
            >
              <View style={estilos.etiquetas}>
                <Text style={[estilos.etiqueta, pago.esRendicion ? estilos.etiquetaRendicion : estilos.etiquetaNo]}>
                  {pago.esRendicion ? "RENDICIÓN" : "NO RENDICIÓN"}
                </Text>
                {pago.esRendicion && pago.documentos.length === 0 ? (
                  <Text style={[estilos.etiqueta, estilos.etiquetaFalta]}>FALTA FOLIO</Text>
                ) : null}
              </View>
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
              <Text style={estilos.lineas}>
                {!pago.esRendicion
                  ? "No requiere folio"
                  : pago.documentos.length === 0
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

function fechaBanco(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso
}

async function exportar(pagos: Pago[], mes: string | null) {
  const encabezado = [
    "FECHA",
    "DESCRIPCION",
    "TITULAR/ADICIONAL",
    "MONTO",
    "CUOTAS PENDIENTES",
    "VALOR CUOTA",
    "CATEGORIA",
    "FOLIO",
    "OBS",
    "ESTADO",
    "pago_id",
    "proveedor",
    "tarjeta",
    "descripcion_app",
    "estado_cuadre",
    "monto_documentos",
    "ejemplo",
  ]
  const filas = pagos.map((pago) => {
    const cuadre = cuadreDe(pago.monto, pago.documentos)
    const proveedor = pago.proveedor.trim()
    return [
      fechaBanco(pago.fecha),
      `COMPRA ${proveedor}`.trim().toUpperCase(),
      "Titular",
      pago.monto,
      0,
      pago.monto,
      pago.esRendicion ? "RENDICION" : "NO",
      pago.esRendicion ? folioBanco(pago.documentos) : "",
      pago.esRendicion ? proveedor : "",
      "",
      pago.id,
      proveedor,
      pago.tarjeta,
      pago.descripcion,
      pago.esRendicion ? etiquetaCuadre(cuadre) : "No rendición",
      pago.esRendicion ? cuadre.suma : "",
      pago.ejemplo ? "si" : "no",
    ]
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
  pago: { backgroundColor: colores.tarjeta, borderLeftWidth: 6, borderRadius: 16, gap: 8, padding: 14 },
  etiquetas: { flexDirection: "row", gap: 6 },
  etiqueta: { borderRadius: 999, fontSize: 11, fontWeight: "700", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 3 },
  etiquetaRendicion: { backgroundColor: colores.cuadraFondo, color: colores.cuadraTexto },
  etiquetaNo: { backgroundColor: colores.vacioFondo, color: colores.vacioTexto },
  etiquetaFalta: { backgroundColor: colores.faltaFondo, color: colores.faltaTexto },
  pagoCabeza: { flexDirection: "row", gap: 12, justifyContent: "space-between" },
  flex: { flex: 1 },
  fecha: { color: colores.muted, fontSize: 13 },
  proveedor: { color: colores.tinta, fontSize: 20, fontWeight: "700" },
  proveedorVacio: { color: colores.muted },
  monto: { color: colores.tinta, fontSize: 18, fontWeight: "700" },
  lineas: { color: colores.tinta, fontSize: 13, lineHeight: 18 },
  meta: { color: colores.muted, fontSize: 12 },
})
