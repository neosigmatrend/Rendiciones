import { Pressable, StyleSheet, Text, View } from "react-native"
import { cuadreDe, etiquetaCuadre, formatCLP } from "./format"
import type { Cuadre, Documento } from "./types"

export const colores = {
  fondo: "#F4F0E6",
  tinta: "#1C2A33",
  primario: "#1E4C55",
  primarioTexto: "#F7F4EC",
  tarjeta: "#FFFCF7",
  borde: "#E3DACC",
  muted: "#5E6A72",
  cuadraFondo: "#D7F0E1",
  cuadraTexto: "#145C38",
  faltaFondo: "#F8E7C2",
  faltaTexto: "#7A4E00",
  sobraFondo: "#F8D4D4",
  sobraTexto: "#8C1D1D",
  vacioFondo: "#E6E1D6",
  vacioTexto: "#4A453C",
  peligro: "#8C1D1D",
}

const estilosCuadre: Record<Cuadre["estado"], { fondo: string; texto: string }> = {
  cuadra: { fondo: colores.cuadraFondo, texto: colores.cuadraTexto },
  falta: { fondo: colores.faltaFondo, texto: colores.faltaTexto },
  sobra: { fondo: colores.sobraFondo, texto: colores.sobraTexto },
  sin_documentos: { fondo: colores.vacioFondo, texto: colores.vacioTexto },
}

export function MarcaCuadre({ cuadre }: { cuadre: Cuadre }) {
  const estilo = estilosCuadre[cuadre.estado]
  return (
    <View style={[estilos.marca, { backgroundColor: estilo.fondo }]}>
      <Text style={[estilos.marcaTexto, { color: estilo.texto }]}>{etiquetaCuadre(cuadre)}</Text>
    </View>
  )
}

export function PanelCuadre({
  monto,
  documentos,
}: {
  monto: number
  documentos: Pick<Documento, "folio" | "monto">[]
}) {
  const cuadre = cuadreDe(monto, documentos)
  return (
    <View style={estilos.panel}>
      <View style={estilos.panelFila}>
        <Dato etiqueta="Monto del pago" valor={formatCLP(monto || 0)} />
        <Dato etiqueta="Documentos" valor={formatCLP(cuadre.suma)} />
        <Dato etiqueta="Diferencia" valor={formatCLP(Math.abs(cuadre.diferencia))} />
      </View>
      <MarcaCuadre cuadre={cuadre} />
    </View>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={estilos.dato}>
      <Text style={estilos.datoEtiqueta}>{etiqueta}</Text>
      <Text style={estilos.datoValor}>{valor}</Text>
    </View>
  )
}

export function Boton({
  titulo,
  onPress,
  variante = "primario",
  disabled = false,
}: {
  titulo: string
  onPress: () => void
  variante?: "primario" | "secundario" | "peligro"
  disabled?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.boton,
        variante === "primario" && estilos.botonPrimario,
        variante === "secundario" && estilos.botonSecundario,
        variante === "peligro" && estilos.botonPeligro,
        (pressed || disabled) && estilos.botonPresionado,
      ]}
    >
      <Text
        style={[
          estilos.botonTexto,
          variante === "primario" ? estilos.botonTextoPrimario : estilos.botonTextoSecundario,
          variante === "peligro" && estilos.botonTextoPeligro,
        ]}
      >
        {titulo}
      </Text>
    </Pressable>
  )
}

const estilos = StyleSheet.create({
  marca: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  marcaTexto: { fontSize: 13, fontWeight: "600" },
  panel: {
    backgroundColor: "#EFEADF",
    borderRadius: 16,
    gap: 12,
    padding: 14,
  },
  panelFila: { flexDirection: "row", gap: 8 },
  dato: { flex: 1, gap: 2 },
  datoEtiqueta: {
    color: colores.muted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  datoValor: { color: colores.tinta, fontSize: 16, fontWeight: "700" },
  boton: {
    alignItems: "center",
    borderRadius: 12,
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  botonPrimario: { backgroundColor: colores.primario },
  botonSecundario: { backgroundColor: colores.tarjeta, borderColor: colores.borde, borderWidth: 1 },
  botonPeligro: { backgroundColor: "#F8E4E4" },
  botonPresionado: { opacity: 0.7 },
  botonTexto: { fontSize: 16, fontWeight: "700" },
  botonTextoPrimario: { color: colores.primarioTexto },
  botonTextoSecundario: { color: colores.tinta },
  botonTextoPeligro: { color: colores.peligro },
})
