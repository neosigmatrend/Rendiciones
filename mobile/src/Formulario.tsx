import DateTimePicker from "@react-native-community/datetimepicker"
import * as ImagePicker from "expo-image-picker"
import { useRef, useState, type ReactNode } from "react"
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { usePagos } from "./contexto"
import type { PagoInput } from "./datos"
import {
  dateDeIso,
  etiquetaTipo,
  formatMontoInput,
  hoyIso,
  isoDeDate,
  parseCLP,
} from "./format"
import { combinarLecturas, type DocumentoLeido, type Lectura } from "./leerDocumento"
import { leerFoto } from "./leerFoto"
import type { Foto, Pago, TipoDocumento } from "./types"
import { TIPOS_DOCUMENTO } from "./types"
import { Boton, PanelCuadre, colores } from "./ui"

type Borrador = {
  key: string
  folio: string
  fecha: string
  monto: string
  tipo: TipoDocumento
}

type CapturaNueva = { key: string; uri: string; nombre: string }

function esperar(ms: number) {
  return new Promise((resolver) => setTimeout(resolver, ms))
}

function borradorLeido(documento: DocumentoLeido, indice: number): Borrador {
  return {
    key: `leido-${documento.folio}-${indice}`,
    folio: documento.folio,
    fecha: documento.fecha,
    monto: formatMontoInput(documento.monto),
    tipo: documento.tipo,
  }
}

function mensajeLecturaFallida(motivos: Array<"sin_datos" | "sin_red" | "servicio">): string {
  if (motivos.length > 0 && motivos.every((motivo) => motivo === "sin_datos")) {
    return "No encontré el monto ni los folios en la foto. Quedó adjunta; complétalos a mano."
  }
  return "No pude leer la foto. Quedó adjunta; complétalos a mano. Revisa que el teléfono tenga internet."
}

function borradoresIniciales(pago?: Pago): Borrador[] {
  if (!pago || pago.documentos.length === 0) {
    return [{ key: "nuevo-1", folio: "", fecha: "", monto: "", tipo: "factura" }]
  }
  return pago.documentos.map((documento) => ({
    key: documento.id,
    folio: documento.folio,
    fecha: documento.fecha,
    monto: documento.monto ? formatMontoInput(documento.monto) : "",
    tipo: documento.tipo,
  }))
}

export function Formulario({
  pago,
  tarjetas,
  onCancelar,
  onGuardado,
}: {
  pago?: Pago
  tarjetas: string[]
  onCancelar: () => void
  onGuardado: (id: string) => void
}) {
  const { guardar } = usePagos()
  const fechaInicial = useRef(pago?.fecha ?? hoyIso())
  const [fecha, setFecha] = useState(fechaInicial.current)
  const [mostrarFecha, setMostrarFecha] = useState(false)
  const [proveedor, setProveedor] = useState(pago?.proveedor ?? "")
  const [descripcion, setDescripcion] = useState(pago?.descripcion ?? "")
  const [monto, setMonto] = useState(pago ? formatMontoInput(pago.monto) : "")
  const [tarjeta, setTarjeta] = useState(pago?.tarjeta ?? "")
  const [documentos, setDocumentos] = useState<Borrador[]>(() => borradoresIniciales(pago))
  const [fechaDocumento, setFechaDocumento] = useState<string | null>(null)
  const [fotosGuardadas, setFotosGuardadas] = useState<Foto[]>(pago?.fotos ?? [])
  const [fotosNuevas, setFotosNuevas] = useState<CapturaNueva[]>([])
  const [guardando, setGuardando] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [avisoLectura, setAvisoLectura] = useState<string | null>(null)
  const [lecturaFallida, setLecturaFallida] = useState(false)
  const proveedorRef = useRef(proveedor)
  const montoRef = useRef(monto)
  const fechaRef = useRef(fecha)
  const documentosRef = useRef(documentos)
  proveedorRef.current = proveedor
  montoRef.current = monto
  fechaRef.current = fecha
  documentosRef.current = documentos

  function actualizarDocumento(key: string, cambios: Partial<Borrador>) {
    setDocumentos((actuales) => actuales.map((item) => (item.key === key ? { ...item, ...cambios } : item)))
  }

  async function elegirCapturas(origen: "galeria" | "camara") {
    const permiso =
      origen === "camara"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permiso.granted) {
      Alert.alert(
        "Sin acceso",
        origen === "camara"
          ? "Permite la cámara para fotografiar el comprobante."
          : "Permite el acceso a las fotos para adjuntar la captura de la pantalla.",
      )
      return
    }
    const resultado =
      origen === "camara"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.7,
            allowsMultipleSelection: true,
            selectionLimit: 8,
          })
    if (resultado.canceled) return
    const cupo = 8 - fotosGuardadas.length - fotosNuevas.length
    if (cupo <= 0) {
      Alert.alert("Demasiadas capturas", "Puedes adjuntar hasta 8 capturas por pago.")
      return
    }
    const siguientes = resultado.assets.slice(0, cupo).map((asset) => ({
      key: asset.assetId ?? asset.uri,
      uri: asset.uri,
      nombre: asset.fileName ?? "captura.jpg",
      ancho: asset.width,
    }))
    setFotosNuevas((actuales) => [...actuales, ...siguientes].slice(0, 8))
    setLeyendo(true)
    setLecturaFallida(false)
    setAvisoLectura("Leyendo monto y folios…")
    const lecturas: Lectura[] = []
    const motivos: Array<"sin_datos" | "sin_red" | "servicio"> = []
    try {
      for (let indice = 0; indice < siguientes.length; indice++) {
        if (indice > 0) await esperar(1100)
        const foto = siguientes[indice]
        if (!foto) continue
        const resultadoFoto = await leerFoto(foto.uri, foto.ancho)
        if (resultadoFoto.ok) lecturas.push(resultadoFoto.lectura)
        else motivos.push(resultadoFoto.motivo)
      }
      if (lecturas.length === 0) {
        const mensaje = mensajeLecturaFallida(motivos)
        setLecturaFallida(true)
        setAvisoLectura(mensaje)
        Alert.alert("No leí la captura", mensaje)
        return
      }
      const aviso = aplicarLectura(combinarLecturas(lecturas))
      setLecturaFallida(false)
      setAvisoLectura(aviso)
      Alert.alert("Datos de la captura", aviso)
    } catch {
      setLecturaFallida(true)
      setAvisoLectura("No pude leer la foto. Quedó adjunta; completa el monto y los folios a mano.")
    } finally {
      setLeyendo(false)
    }
  }

  function aplicarLectura(lectura: Lectura): string {
    if (lectura.proveedor && !proveedorRef.current.trim()) setProveedor(lectura.proveedor)
    if (lectura.fecha && fechaRef.current === fechaInicial.current) setFecha(lectura.fecha)
    const montoVacio = !montoRef.current.trim()
    if (lectura.monto != null && montoVacio) setMonto(formatMontoInput(lectura.monto))

    const actuales = documentosRef.current
    const vacios = actuales.every((documento) => !documento.folio.trim() && !documento.fecha && !(parseCLP(documento.monto) ?? 0))
    const existentes = new Set(actuales.map((documento) => documento.folio.trim()).filter(Boolean))
    const nuevos = lectura.documentos.filter((documento) => !existentes.has(documento.folio))
    if (nuevos.length > 0) {
      const filas = nuevos.map((documento, indice) => borradorLeido(documento, indice))
      setDocumentos(vacios ? filas : [...actuales, ...filas])
    }

    if (montoVacio && lectura.monto != null && nuevos.length > 0) {
      return nuevos.length === 1
        ? "Leí el monto y 1 folio. Revísalos antes de guardar."
        : `Leí el monto y ${nuevos.length} folios. Revísalos antes de guardar.`
    }
    if (montoVacio && lectura.monto != null && lectura.documentos.length > 0) {
      return "Leí el monto. Los folios ya estaban en el pago."
    }
    if (montoVacio && lectura.monto != null) {
      return "Leí el monto. En la captura no aparecen folios; puedes completarlos después."
    }
    if (nuevos.length > 0) {
      return nuevos.length === 1 ? "Leí 1 folio. Revisa el monto del cargo." : `Leí ${nuevos.length} folios. Revisa el monto del cargo.`
    }
    return "La foto quedó adjunta. El monto y los folios ya estaban escritos."
  }

  async function onGuardar() {
    const montoNumero = parseCLP(monto)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      Alert.alert("Falta la fecha", "Indica la fecha del pago.")
      return
    }
    if (!proveedor.trim()) {
      Alert.alert("Falta el proveedor", "Indica quién recibió el pago.")
      return
    }
    if (montoNumero == null || montoNumero <= 0) {
      Alert.alert("Falta el monto", "Indica el monto del cargo en la tarjeta.")
      return
    }
    if (!tarjeta.trim()) {
      Alert.alert("Falta la tarjeta", "Indica con qué tarjeta pagaste.")
      return
    }
    if (fotosGuardadas.length + fotosNuevas.length > 8) {
      Alert.alert("Demasiadas capturas", "Puedes adjuntar hasta 8 capturas por pago.")
      return
    }

    const documentosLimpios: PagoInput["documentos"] = []
    for (const documento of documentos) {
      const folio = documento.folio.trim()
      const montoDocumento = parseCLP(documento.monto) ?? 0
      if (!folio && montoDocumento === 0 && !documento.fecha) continue
      if (documento.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(documento.fecha)) {
        Alert.alert("Fecha del documento", "Revisa la fecha de una factura o boleta.")
        return
      }
      documentosLimpios.push({
        folio,
        fecha: documento.fecha,
        monto: montoDocumento,
        tipo: documento.tipo,
      })
    }

    setGuardando(true)
    try {
      const guardado = await guardar(pago?.id ?? null, {
        fecha,
        proveedor: proveedor.trim(),
        descripcion: descripcion.trim(),
        monto: montoNumero,
        tarjeta: tarjeta.trim(),
        documentos: documentosLimpios,
        fotosNuevas: fotosNuevas.map((foto) => ({ uri: foto.uri, nombre: foto.nombre })),
        fotosConservadas: fotosGuardadas,
      })
      onGuardado(guardado.id)
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : "No se pudo guardar el pago."
      Alert.alert("No se guardó", mensaje)
    } finally {
      setGuardando(false)
    }
  }

  const documentosParaCuadre = documentos.map((documento) => ({
    folio: documento.folio,
    monto: parseCLP(documento.monto) ?? 0,
  }))

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={estilos.flex}>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Text style={estilos.titulo}>{pago ? `Editar ${pago.proveedor}` : "Registrar pago"}</Text>
        <Text style={estilos.ayuda}>
          Adjunta la captura del pago. La app lee el monto y los folios. Varias facturas pueden sumar ese cargo, como en Agrosuper o Gasco.
        </Text>

        <Campo etiqueta="Fecha del pago">
          <Pressable onPress={() => setMostrarFecha(true)} style={estilos.selector}>
            <Text style={estilos.selectorTexto}>{fecha.split("-").reverse().join("-")}</Text>
          </Pressable>
          {mostrarFecha ? (
            <DateTimePicker
              value={dateDeIso(fecha)}
              mode="date"
              onChange={(evento, valor) => {
                if (Platform.OS === "android" || evento.type === "dismissed") setMostrarFecha(false)
                if (valor && evento.type !== "dismissed") setFecha(isoDeDate(valor))
              }}
            />
          ) : null}
          {Platform.OS === "ios" && mostrarFecha ? (
            <Boton titulo="Listo" variante="secundario" onPress={() => setMostrarFecha(false)} />
          ) : null}
        </Campo>

        <Campo etiqueta="Proveedor">
          <TextInput
            value={proveedor}
            onChangeText={setProveedor}
            placeholder="Agrosuper, Gasco…"
            placeholderTextColor="#8B938C"
            style={estilos.input}
          />
        </Campo>

        <Campo etiqueta="Monto del cargo">
          <TextInput
            value={monto}
            onChangeText={setMonto}
            onBlur={() => {
              const valor = parseCLP(monto)
              if (valor != null) setMonto(formatMontoInput(valor))
            }}
            keyboardType="number-pad"
            placeholder="166547"
            placeholderTextColor="#8B938C"
            style={estilos.input}
          />
        </Campo>

        <Campo etiqueta="Tarjeta">
          <TextInput
            value={tarjeta}
            onChangeText={setTarjeta}
            placeholder="Visa empresa"
            placeholderTextColor="#8B938C"
            style={estilos.input}
          />
          {tarjetas.length > 0 ? (
            <View style={estilos.chips}>
              {tarjetas.map((nombre) => (
                <Pressable key={nombre} onPress={() => setTarjeta(nombre)} style={estilos.chip}>
                  <Text style={estilos.chipTexto}>{nombre}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Campo>

        <Campo etiqueta="Descripción">
          <TextInput
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Pago en línea, recarga granel…"
            placeholderTextColor="#8B938C"
            style={estilos.input}
          />
        </Campo>

        <Text style={estilos.seccion}>Captura de la pantalla</Text>
        <Text style={estilos.ayuda}>
          Al adjuntar la captura se completan el monto y los folios. La foto se envía a OCR.space; hace falta internet.
        </Text>
        <View style={estilos.acciones}>
          <Boton
            titulo="Adjuntar captura"
            variante="secundario"
            disabled={leyendo || guardando}
            onPress={() => elegirCapturas("galeria")}
          />
          <Boton
            titulo="Tomar foto"
            variante="secundario"
            disabled={leyendo || guardando}
            onPress={() => elegirCapturas("camara")}
          />
        </View>
        {avisoLectura ? (
          <Text style={[estilos.aviso, lecturaFallida && estilos.avisoError]}>{avisoLectura}</Text>
        ) : null}
        <View style={estilos.fotos}>
          {fotosGuardadas.map((foto) => (
            <VistaFoto
              key={foto.id}
              uri={foto.uri}
              onQuitar={() => setFotosGuardadas((actuales) => actuales.filter((item) => item.id !== foto.id))}
            />
          ))}
          {fotosNuevas.map((foto) => (
            <VistaFoto
              key={foto.key}
              uri={foto.uri}
              onQuitar={() => setFotosNuevas((actuales) => actuales.filter((item) => item.key !== foto.key))}
            />
          ))}
        </View>

        <Text style={estilos.seccion}>Documentos del pago</Text>
        <Text style={estilos.ayuda}>
          Cada factura o boleta va en su línea. Si el folio todavía no está, guarda el pago y complétalo después.
        </Text>
        {documentos.map((documento, indice) => (
          <View key={documento.key} style={estilos.documento}>
            <View style={estilos.documentoCabeza}>
              <Text style={estilos.documentoTitulo}>Documento {indice + 1}</Text>
              {documentos.length > 1 ? (
                <Pressable onPress={() => setDocumentos((actuales) => actuales.filter((item) => item.key !== documento.key))}>
                  <Text style={estilos.quitar}>Quitar</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={estilos.chips}>
              {TIPOS_DOCUMENTO.map((tipo) => (
                <Pressable
                  key={tipo}
                  onPress={() => actualizarDocumento(documento.key, { tipo })}
                  style={[estilos.chip, documento.tipo === tipo && estilos.chipActivo]}
                >
                  <Text style={[estilos.chipTexto, documento.tipo === tipo && estilos.chipTextoActivo]}>
                    {etiquetaTipo(tipo)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={documento.folio}
              onChangeText={(folio) => actualizarDocumento(documento.key, { folio })}
              placeholder="Folio 101070510"
              placeholderTextColor="#8B938C"
              style={estilos.input}
            />
            <Pressable onPress={() => setFechaDocumento(documento.key)} style={estilos.selector}>
              <Text style={documento.fecha ? estilos.selectorTexto : estilos.placeholder}>
                {documento.fecha ? documento.fecha.split("-").reverse().join("-") : "Fecha del documento"}
              </Text>
            </Pressable>
            {fechaDocumento === documento.key ? (
              <DateTimePicker
                value={documento.fecha ? dateDeIso(documento.fecha) : new Date()}
                mode="date"
                onChange={(evento, valor) => {
                  if (Platform.OS === "android" || evento.type === "dismissed") setFechaDocumento(null)
                  if (valor && evento.type !== "dismissed") actualizarDocumento(documento.key, { fecha: isoDeDate(valor) })
                }}
              />
            ) : null}
            <TextInput
              value={documento.monto}
              onChangeText={(valor) => actualizarDocumento(documento.key, { monto: valor })}
              onBlur={() => {
                const valor = parseCLP(documento.monto)
                if (valor != null) actualizarDocumento(documento.key, { monto: formatMontoInput(valor) })
              }}
              keyboardType="number-pad"
              placeholder="Monto"
              placeholderTextColor="#8B938C"
              style={estilos.input}
            />
          </View>
        ))}
        <Boton
          titulo="Agregar documento"
          variante="secundario"
          onPress={() =>
            setDocumentos((actuales) => [
              ...actuales,
              { key: `${Date.now()}`, folio: "", fecha: "", monto: "", tipo: "factura" },
            ])
          }
        />

        <PanelCuadre monto={parseCLP(monto) ?? 0} documentos={documentosParaCuadre} />

        <View style={estilos.acciones}>
          <Boton titulo="Cancelar" variante="secundario" onPress={onCancelar} />
          <Boton
            titulo={leyendo ? "Leyendo foto…" : guardando ? "Guardando…" : "Guardar pago"}
            onPress={onGuardar}
            disabled={guardando || leyendo}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      {children}
    </View>
  )
}

function VistaFoto({ uri, onQuitar }: { uri: string; onQuitar: () => void }) {
  return (
    <View style={estilos.foto}>
      <Image source={{ uri }} style={estilos.imagen} />
      <Pressable onPress={onQuitar} style={estilos.fotoQuitar}>
        <Text style={estilos.fotoQuitarTexto}>Quitar</Text>
      </Pressable>
    </View>
  )
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  contenido: { gap: 12, padding: 16, paddingBottom: 40 },
  titulo: { color: colores.tinta, fontSize: 28, fontWeight: "700" },
  seccion: { color: colores.tinta, fontSize: 20, fontWeight: "700", marginTop: 8 },
  ayuda: { color: colores.muted, fontSize: 15, lineHeight: 21 },
  aviso: { color: colores.tinta, fontSize: 15, lineHeight: 21 },
  avisoError: { color: colores.faltaTexto },
  campo: { gap: 6 },
  etiqueta: { color: colores.tinta, fontSize: 14, fontWeight: "700" },
  input: {
    backgroundColor: colores.tarjeta,
    borderColor: colores.borde,
    borderRadius: 12,
    borderWidth: 1,
    color: colores.tinta,
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  selector: {
    backgroundColor: colores.tarjeta,
    borderColor: colores.borde,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 12,
  },
  selectorTexto: { color: colores.tinta, fontSize: 16 },
  placeholder: { color: "#8B938C", fontSize: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: colores.tarjeta,
    borderColor: colores.borde,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActivo: { backgroundColor: colores.primario, borderColor: colores.primario },
  chipTexto: { color: colores.tinta, fontSize: 14, fontWeight: "600" },
  chipTextoActivo: { color: colores.primarioTexto },
  acciones: { gap: 8 },
  fotos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  foto: { width: 104 },
  imagen: { backgroundColor: "#DDD6C8", borderRadius: 12, height: 78, width: 104 },
  fotoQuitar: { alignItems: "center", paddingVertical: 4 },
  fotoQuitarTexto: { color: colores.muted, fontSize: 13, textDecorationLine: "underline" },
  documento: {
    backgroundColor: colores.tarjeta,
    borderColor: colores.borde,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  documentoCabeza: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  documentoTitulo: { color: colores.tinta, fontSize: 15, fontWeight: "700" },
  quitar: { color: colores.muted, fontSize: 14, textDecorationLine: "underline" },
})
