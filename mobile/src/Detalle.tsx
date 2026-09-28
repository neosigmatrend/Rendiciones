import { useState } from "react"
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { usePagos } from "./contexto"
import { etiquetaTipo, formatCLP, formatFecha, formatFechaLarga } from "./format"
import { Boton, PanelTotal, colores } from "./ui"

export function Detalle({
  id,
  onVolver,
  onEditar,
  onEliminado,
}: {
  id: string
  onVolver: () => void
  onEditar: () => void
  onEliminado: () => void
}) {
  const { pagos, borrar } = usePagos()
  const pago = pagos.find((item) => item.id === id)
  const [fotoAbierta, setFotoAbierta] = useState<string | null>(null)
  const [verTexto, setVerTexto] = useState(false)
  const textoLeido = pago?.fotos.find((foto) => foto.texto?.trim())?.texto

  if (!pago) {
    return (
      <View style={estilos.centrado}>
        <Text style={estilos.titulo}>Ese pago no está</Text>
        <Boton titulo="Volver" onPress={onVolver} />
      </View>
    )
  }

  function confirmarBorrado() {
    const nombre = pago?.proveedor.trim() || "este proveedor"
    Alert.alert("Eliminar este pago", `Se borra el pago de ${nombre}, sus documentos y las capturas.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => {
          void borrar(pago!.id).then(onEliminado)
        },
      },
    ])
  }

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Pressable onPress={onVolver}>
        <Text style={estilos.volver}>Volver a los pagos</Text>
      </Pressable>
      <Text style={estilos.fecha}>{formatFechaLarga(pago.fecha)}</Text>
      <Text style={estilos.titulo}>{pago.proveedor.trim() || "Sin proveedor"}</Text>
      <Text style={estilos.ayuda}>{[pago.descripcion, pago.tarjeta].filter(Boolean).join(" · ")}</Text>
      {pago.ejemplo ? <Text style={estilos.ejemplo}>Ejemplo</Text> : null}
      <PanelTotal monto={pago.monto} documentos={pago.documentos} />

      <Text style={estilos.seccion}>Capturas</Text>
      {pago.fotos.length === 0 ? (
        <Text style={estilos.vacio}>Este pago todavía no tiene captura. Puedes adjuntarla al editarlo.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.fotos}>
          {pago.fotos.map((foto) =>
            /\.pdf$/i.test(foto.nombre) ? (
              <View key={foto.id} style={[estilos.foto, estilos.fotoArchivo]}>
                <Text style={estilos.folio} numberOfLines={3}>
                  {foto.nombre}
                </Text>
              </View>
            ) : (
              <Pressable key={foto.id} onPress={() => setFotoAbierta(foto.uri)}>
                <Image source={{ uri: foto.uri }} style={estilos.foto} />
              </Pressable>
            ),
          )}
        </ScrollView>
      )}

      <Text style={estilos.seccion}>Documentos</Text>
      {pago.documentos.length === 0 ? (
        <Text style={estilos.vacio}>Este pago no tiene facturas ni boletas asociadas.</Text>
      ) : (
        pago.documentos.map((documento) => (
          <View key={documento.id} style={estilos.documento}>
            <View style={estilos.flex}>
              <Text style={estilos.folio}>{documento.folio || "Sin folio"}</Text>
              <Text style={estilos.ayuda}>
                {etiquetaTipo(documento.tipo)}
                {documento.fecha ? ` · ${formatFecha(documento.fecha)}` : ""}
              </Text>
            </View>
            <Text style={estilos.monto}>{formatCLP(documento.monto)}</Text>
          </View>
        ))
      )}
      {textoLeido ? (
        <>
          <Boton
            titulo={verTexto ? "Ocultar texto leído" : "Ver texto leído"}
            variante="secundario"
            onPress={() => setVerTexto((actual) => !actual)}
          />
          {verTexto ? (
            <View style={estilos.documento}>
              <Text selectable style={estilos.textoOcr}>
                {textoLeido}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
      <Boton titulo="Editar" variante="secundario" onPress={onEditar} />
      <Boton titulo="Eliminar" variante="peligro" onPress={confirmarBorrado} />

      <Modal visible={fotoAbierta !== null} transparent animationType="fade" onRequestClose={() => setFotoAbierta(null)}>
        <Pressable style={estilos.modal} onPress={() => setFotoAbierta(null)}>
          {fotoAbierta ? <Image source={{ uri: fotoAbierta }} style={estilos.modalImagen} resizeMode="contain" /> : null}
          <Text style={estilos.modalCerrar}>Cerrar</Text>
        </Pressable>
      </Modal>
    </ScrollView>
  )
}

const estilos = StyleSheet.create({
  contenido: { gap: 12, padding: 16, paddingBottom: 40 },
  centrado: { flex: 1, gap: 12, justifyContent: "center", padding: 24 },
  volver: { color: colores.muted, fontSize: 15, textDecorationLine: "underline" },
  fecha: { color: colores.muted, fontSize: 14 },
  titulo: { color: colores.tinta, fontSize: 30, fontWeight: "700" },
  ayuda: { color: colores.muted, fontSize: 15, lineHeight: 21 },
  ejemplo: {
    alignSelf: "flex-start",
    backgroundColor: "#EFEADF",
    borderRadius: 999,
    color: colores.tinta,
    fontSize: 13,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  seccion: { color: colores.tinta, fontSize: 20, fontWeight: "700", marginTop: 6 },
  vacio: { color: colores.muted, fontSize: 15, lineHeight: 21 },
  fotos: { gap: 8 },
  foto: { backgroundColor: "#DDD6C8", borderRadius: 12, height: 140, width: 180 },
  fotoArchivo: { justifyContent: "center", padding: 12 },
  textoOcr: { color: colores.tinta, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 12, lineHeight: 17 },
  documento: {
    alignItems: "center",
    backgroundColor: colores.tarjeta,
    borderRadius: 14,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  flex: { flex: 1 },
  folio: { color: colores.tinta, fontSize: 16, fontWeight: "700" },
  monto: { color: colores.tinta, fontSize: 16, fontWeight: "700" },
  estado: { color: colores.muted, fontSize: 14 },
  modal: { alignItems: "center", backgroundColor: "rgba(20, 24, 28, 0.92)", flex: 1, justifyContent: "center", padding: 16 },
  modalImagen: { height: "75%", width: "100%" },
  modalCerrar: { color: "#F7F4EC", fontSize: 16, marginTop: 16 },
})
