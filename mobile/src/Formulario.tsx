import DateTimePicker from "@react-native-community/datetimepicker"
import * as ImagePicker from "expo-image-picker"
import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  ActivityIndicator,
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
  cuadreDe,
  dateDeIso,
  etiquetaTipo,
  formatCLP,
  formatFecha,
  formatMontoInput,
  hoyIso,
  isoDeDate,
  parseCLP,
} from "./format"
import { combinarLecturas, type DocumentoLeido, type Lectura, type MontoCandidato } from "./leerDocumento"
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

type CapturaNueva = { key: string; uri: string; nombre: string; ancho?: number }

type Paso = "capturar" | "leyendo" | "confirmar"

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
    return "No encontré el monto ni los folios en la captura."
  }
  if (motivos.includes("sin_red")) return "No pude leer la captura. Revisa que el teléfono tenga internet."
  return "No pude leer el monto en esta captura."
}

function mensajeLectura(lectura: Lectura): string {
  const estado = cuadreDe(lectura.monto ?? 0, lectura.documentos).estado
  if (lectura.monto == null) return "No encontré el monto en la captura."
  if (estado === "cuadra") {
    return lectura.documentos.length === 1
      ? "Leí 1 folio y suma el monto. Confírmalo."
      : `Leí ${lectura.documentos.length} folios y suman el monto. Confírmalos.`
  }
  if (estado === "sin_documentos") return "Leí el monto. Esta captura no trae folios."
  return "Los montos leídos no cuadran. Corrígelos antes de confirmar."
}

function borradoresIniciales(pago?: Pago): Borrador[] {
  if (!pago) return []
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
  const [paso, setPaso] = useState<Paso>(pago ? "confirmar" : "capturar")
  const [fecha, setFecha] = useState(pago?.fecha ?? hoyIso())
  const [mostrarFecha, setMostrarFecha] = useState(false)
  const [proveedor, setProveedor] = useState(pago?.proveedor ?? "")
  const [descripcion, setDescripcion] = useState(pago?.descripcion ?? "")
  const [monto, setMonto] = useState(pago ? formatMontoInput(pago.monto) : "")
  const [tarjeta, setTarjeta] = useState(pago?.tarjeta ?? tarjetas[0] ?? "")
  const [documentos, setDocumentos] = useState<Borrador[]>(() => borradoresIniciales(pago))
  const [fechaDocumento, setFechaDocumento] = useState<string | null>(null)
  const [fotosGuardadas, setFotosGuardadas] = useState<Foto[]>(pago?.fotos ?? [])
  const [fotosNuevas, setFotosNuevas] = useState<CapturaNueva[]>([])
  const [guardando, setGuardando] = useState(false)
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [avisoLectura, setAvisoLectura] = useState<string | null>(null)
  const [lecturaFallida, setLecturaFallida] = useState(false)
  const [montosCandidatos, setMontosCandidatos] = useState<MontoCandidato[]>([])
  const [foliosCandidatos, setFoliosCandidatos] = useState<DocumentoLeido[]>([])
  const camaraAbierta = useRef(false)

  function actualizarDocumento(key: string, cambios: Partial<Borrador>) {
    setDocumentos((actuales) => actuales.map((item) => (item.key === key ? { ...item, ...cambios } : item)))
  }

  function aplicarLectura(lectura: Lectura) {
    if (lectura.proveedor) setProveedor(lectura.proveedor)
    if (lectura.fecha) setFecha(lectura.fecha)
    if (lectura.descripcion) setDescripcion(lectura.descripcion)
    if (lectura.monto != null) setMonto(formatMontoInput(lectura.monto))
    setDocumentos(lectura.documentos.map((documento, indice) => borradorLeido(documento, indice)))
    setMontosCandidatos(lectura.montosCandidatos)
    setFoliosCandidatos(lectura.foliosCandidatos)
    const estado = cuadreDe(lectura.monto ?? 0, lectura.documentos).estado
    setCorrigiendo(lectura.monto == null || estado === "falta" || estado === "sobra")
    setLecturaFallida(lectura.monto == null)
    setAvisoLectura(mensajeLectura(lectura))
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
          ? "Permite la cámara para fotografiar la pantalla del pago."
          : "Permite el acceso a las fotos para adjuntar la captura.",
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
    setPaso("leyendo")
    setLecturaFallida(false)
    setAvisoLectura(null)
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
        setLecturaFallida(true)
        setCorrigiendo(true)
        setAvisoLectura(mensajeLecturaFallida(motivos))
      } else {
        aplicarLectura(combinarLecturas(lecturas))
      }
    } catch {
      setLecturaFallida(true)
      setCorrigiendo(true)
      setAvisoLectura("No pude leer el monto en esta captura.")
    } finally {
      setPaso("confirmar")
    }
  }

  function alternarFolio(candidato: DocumentoLeido) {
    setDocumentos((actuales) => {
      const dentro = actuales.some((item) => item.folio === candidato.folio)
      if (dentro) return actuales.filter((item) => item.folio !== candidato.folio)
      return [...actuales, borradorLeido(candidato, actuales.length)]
    })
  }

  useEffect(() => {
    if (pago || camaraAbierta.current) return
    camaraAbierta.current = true
    void elegirCapturas("camara")
  }, [pago])

  async function onGuardar(forzar: boolean) {
    const montoNumero = parseCLP(monto)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      Alert.alert("Falta la fecha", "Indica la fecha del pago.")
      return
    }
    if (montoNumero == null || montoNumero <= 0) {
      setCorrigiendo(true)
      Alert.alert("Falta el monto", "La captura no trajo el monto del cargo.")
      return
    }
    if (!tarjeta.trim()) {
      Alert.alert("Falta la tarjeta", "Elige con qué tarjeta pagaste.")
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
    const estado = cuadreDe(montoNumero, documentosLimpios).estado
    if (!forzar && estado !== "cuadra" && estado !== "sin_documentos") {
      setCorrigiendo(true)
      Alert.alert("No cuadra", "Los folios no suman el monto del cargo.")
      return
    }
    if (fotosGuardadas.length + fotosNuevas.length > 8) {
      Alert.alert("Demasiadas capturas", "Puedes adjuntar hasta 8 capturas por pago.")
      return
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
  const cuadre = cuadreDe(parseCLP(monto) ?? 0, documentosParaCuadre)
  const puedeConfirmar = cuadre.estado === "cuadra" || cuadre.estado === "sin_documentos"
  const fotoPrincipal = fotosNuevas[fotosNuevas.length - 1]?.uri ?? fotosGuardadas[0]?.uri

  if (paso === "capturar") {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={estilos.titulo}>Capturar pago</Text>
        <Text style={estilos.version}>versión 8</Text>
        <Text style={estilos.ayuda}>
          Fotografía la boleta o la pantalla del pago. La app lee el monto y los folios, comprueba que sumen el cargo y te pide confirmar.
        </Text>
        <Text style={estilos.ayuda}>Hace falta internet: la captura se envía a OCR.space para leerla.</Text>
        <Boton titulo="Tomar foto" onPress={() => elegirCapturas("camara")} />
        <Boton titulo="Adjuntar captura" variante="secundario" onPress={() => elegirCapturas("galeria")} />
        <Boton titulo="Cancelar" variante="secundario" onPress={onCancelar} />
      </ScrollView>
    )
  }

  if (paso === "leyendo") {
    return (
      <View style={estilos.leyendo}>
        {fotoPrincipal ? <Image source={{ uri: fotoPrincipal }} style={estilos.fotoGrande} /> : null}
        <ActivityIndicator color={colores.primario} />
        <Text style={estilos.tituloChico}>Leyendo monto y folios…</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={estilos.flex}>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Text style={estilos.titulo}>{pago ? "Revisar pago" : "Confirmar pago"}</Text>
        <Text style={estilos.ayuda}>
          {puedeConfirmar
            ? "Esto es lo que leí en la captura. Si está bien, confirma."
            : "Los folios no suman el monto. Corrige lo que esté mal y después confirma."}
        </Text>
        {avisoLectura ? <Text style={[estilos.aviso, lecturaFallida && estilos.avisoError]}>{avisoLectura}</Text> : null}
        {fotoPrincipal ? <Image source={{ uri: fotoPrincipal }} style={estilos.fotoGrande} /> : null}

        <DatoLeido etiqueta="Proveedor" valor={proveedor} vacio="Sin proveedor" editable={corrigiendo}>
          <TextInput
            value={proveedor}
            onChangeText={setProveedor}
            placeholder="Agrosuper, Gasco…"
            placeholderTextColor="#8B938C"
            style={estilos.input}
          />
        </DatoLeido>

        <DatoLeido etiqueta="Fecha" valor={formatFecha(fecha)} editable={corrigiendo}>
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
        </DatoLeido>

        <DatoLeido
          etiqueta="Monto del cargo"
          valor={parseCLP(monto) != null ? formatCLP(parseCLP(monto) ?? 0) : ""}
          vacio="Sin monto"
          editable={corrigiendo || !(parseCLP(monto) ?? 0)}
        >
          <TextInput
            value={monto}
            onChangeText={setMonto}
            onBlur={() => {
              const valor = parseCLP(monto)
              if (valor != null) setMonto(formatMontoInput(valor))
            }}
            keyboardType="number-pad"
            placeholder="Monto"
            placeholderTextColor="#8B938C"
            style={estilos.input}
          />
        </DatoLeido>

        {descripcion || corrigiendo ? (
          <DatoLeido etiqueta="Descripción" valor={descripcion} vacio="Sin descripción" editable={corrigiendo}>
            <TextInput
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="Pago en línea, recarga…"
              placeholderTextColor="#8B938C"
              style={estilos.input}
            />
          </DatoLeido>
        ) : null}

        {montosCandidatos.length > 1 ? (
          <>
            <Text style={estilos.seccion}>Montos en la captura</Text>
            <Text style={estilos.ayuda}>Toca el que te cobraron en la tarjeta.</Text>
            <View style={estilos.chips}>
              {montosCandidatos.map((candidato) => {
                const elegido = (parseCLP(monto) ?? 0) === candidato.valor
                return (
                  <Pressable
                    key={`${candidato.valor}-${candidato.etiqueta}`}
                    onPress={() => setMonto(formatMontoInput(candidato.valor))}
                    style={[estilos.chip, elegido && estilos.chipActivo]}
                  >
                    <Text style={[estilos.chipTexto, elegido && estilos.chipTextoActivo]}>
                      {formatCLP(candidato.valor)} · {candidato.etiqueta}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </>
        ) : null}

        {foliosCandidatos.length > 0 ? (
          <>
            <Text style={estilos.seccion}>Folios en la captura</Text>
            <Text style={estilos.ayuda}>Marca los que entran en este pago.</Text>
            <View style={estilos.chips}>
              {foliosCandidatos.map((candidato) => {
                const elegido = documentos.some((item) => item.folio === candidato.folio)
                return (
                  <Pressable
                    key={candidato.folio}
                    onPress={() => alternarFolio(candidato)}
                    style={[estilos.chip, elegido && estilos.chipActivo]}
                  >
                    <Text style={[estilos.chipTexto, elegido && estilos.chipTextoActivo]}>
                      {elegido ? "✓ " : ""}
                      {candidato.folio}
                      {candidato.monto > 0 ? ` · ${formatCLP(candidato.monto)}` : ""}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </>
        ) : null}

        <Text style={estilos.seccion}>Folios</Text>
        {documentos.length === 0 ? <Text style={estilos.ayuda}>Esta captura no trae folios.</Text> : null}
        {documentos.map((documento, indice) =>
          corrigiendo ? (
            <View key={documento.key} style={estilos.documento}>
              <View style={estilos.documentoCabeza}>
                <Text style={estilos.documentoTitulo}>Documento {indice + 1}</Text>
                <Pressable onPress={() => setDocumentos((actuales) => actuales.filter((item) => item.key !== documento.key))}>
                  <Text style={estilos.quitar}>Quitar</Text>
                </Pressable>
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
                placeholder="Folio"
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
          ) : (
            <View key={documento.key} style={estilos.documento}>
              <Text style={estilos.documentoTitulo}>
                {etiquetaTipo(documento.tipo)} {documento.folio || "sin folio"}
              </Text>
              <Text style={estilos.ayuda}>
                {(documento.fecha ? formatFecha(documento.fecha) : "Sin fecha") +
                  " · " +
                  formatCLP(parseCLP(documento.monto) ?? 0)}
              </Text>
            </View>
          ),
        )}
        {corrigiendo ? (
          <Boton
            titulo="Agregar folio"
            variante="secundario"
            onPress={() =>
              setDocumentos((actuales) => [
                ...actuales,
                { key: `${Date.now()}`, folio: "", fecha: "", monto: "", tipo: "factura" },
              ])
            }
          />
        ) : null}

        <PanelCuadre monto={parseCLP(monto) ?? 0} documentos={documentosParaCuadre} />

        <Campo etiqueta="Tarjeta">
          {tarjetas.length > 0 ? (
            <View style={estilos.chips}>
              {tarjetas.map((nombre) => (
                <Pressable
                  key={nombre}
                  onPress={() => setTarjeta(nombre)}
                  style={[estilos.chip, tarjeta === nombre && estilos.chipActivo]}
                >
                  <Text style={[estilos.chipTexto, tarjeta === nombre && estilos.chipTextoActivo]}>{nombre}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {corrigiendo || !tarjeta.trim() || !tarjetas.includes(tarjeta) ? (
            <TextInput
              value={tarjeta}
              onChangeText={setTarjeta}
              placeholder="Visa empresa"
              placeholderTextColor="#8B938C"
              style={estilos.input}
            />
          ) : null}
        </Campo>

        <Boton
          titulo={corrigiendo ? "Ver lectura" : "Corregir"}
          variante="secundario"
          onPress={() => setCorrigiendo((actual) => !actual)}
        />
        <View style={estilos.acciones}>
          <Boton titulo="Otra captura" variante="secundario" onPress={() => elegirCapturas("galeria")} disabled={guardando} />
          <Boton titulo="Tomar otra foto" variante="secundario" onPress={() => elegirCapturas("camara")} disabled={guardando} />
        </View>
        <Boton
          titulo={guardando ? "Guardando…" : pago ? "Guardar cambios" : "Confirmar pago"}
          onPress={() => onGuardar(false)}
          disabled={guardando || !puedeConfirmar}
        />
        {!puedeConfirmar ? (
          <Pressable onPress={() => onGuardar(true)} disabled={guardando}>
            <Text style={estilos.quitar}>Confirmar aunque no cuadre</Text>
          </Pressable>
        ) : null}
        <Boton titulo="Cancelar" variante="secundario" onPress={onCancelar} />
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

function DatoLeido({
  etiqueta,
  valor,
  vacio = "",
  editable,
  children,
}: {
  etiqueta: string
  valor: string
  vacio?: string
  editable: boolean
  children: ReactNode
}) {
  if (editable) return <Campo etiqueta={etiqueta}>{children}</Campo>
  return (
    <View style={estilos.dato}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <Text style={estilos.datoValor}>{valor.trim() || vacio}</Text>
    </View>
  )
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  contenido: { gap: 12, padding: 16, paddingBottom: 40 },
  leyendo: { alignItems: "center", flex: 1, gap: 16, justifyContent: "center", padding: 24 },
  titulo: { color: colores.tinta, fontSize: 28, fontWeight: "700" },
  version: { color: colores.primario, fontSize: 22, fontWeight: "700" },
  tituloChico: { color: colores.tinta, fontSize: 18, fontWeight: "700" },
  seccion: { color: colores.tinta, fontSize: 20, fontWeight: "700", marginTop: 8 },
  ayuda: { color: colores.muted, fontSize: 15, lineHeight: 21 },
  aviso: { color: colores.tinta, fontSize: 15, lineHeight: 21 },
  avisoError: { color: colores.faltaTexto },
  campo: { gap: 6 },
  dato: { gap: 2 },
  datoValor: { color: colores.tinta, fontSize: 20, fontWeight: "700" },
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
  fotoGrande: { backgroundColor: "#DDD6C8", borderRadius: 16, height: 220, width: "100%" },
  documento: {
    backgroundColor: colores.tarjeta,
    borderColor: colores.borde,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  documentoCabeza: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  documentoTitulo: { color: colores.tinta, fontSize: 16, fontWeight: "700" },
  quitar: { color: colores.muted, fontSize: 14, textAlign: "center", textDecorationLine: "underline" },
})
