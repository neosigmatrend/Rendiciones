import DateTimePicker from "@react-native-community/datetimepicker"
import * as DocumentPicker from "expo-document-picker"
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
import { leerFoto, leerPdf } from "./leerFoto"
import type { Foto, Pago, TipoDocumento } from "./types"
import { TIPOS_DOCUMENTO } from "./types"
import { Boton, PanelTotal, colores } from "./ui"

type Borrador = {
  key: string
  folio: string
  fecha: string
  monto: string
  tipo: TipoDocumento
}

type CapturaNueva = { key: string; uri: string; nombre: string; ancho?: number; esPdf?: boolean }

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
  if (lectura.documentos.length === 1) return "Leí 1 folio con su monto. Confírmalo."
  if (lectura.documentos.length > 1) return `Leí ${lectura.documentos.length} folios con sus montos. Confírmalos.`
  if (lectura.monto == null) return "No encontré el monto en la captura."
  return "Leí el monto. Esta captura no trae folios."
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
  const [folioActivo, setFolioActivo] = useState<string | null>(null)
  const [montoManual, setMontoManual] = useState(Boolean(pago))
  const [textosLeidos, setTextosLeidos] = useState<Map<string, string>>(new Map())
  const [verTexto, setVerTexto] = useState(false)
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
    setMontoManual(lectura.documentos.length === 0)
    setCorrigiendo(false)
    setLecturaFallida(lectura.monto == null && lectura.documentos.length === 0)
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
    await leerCapturas(siguientes)
  }

  async function elegirArchivos() {
    const resultado = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      multiple: true,
      copyToCacheDirectory: true,
    })
    if (resultado.canceled) return
    const cupo = 8 - fotosGuardadas.length - fotosNuevas.length
    if (cupo <= 0) {
      Alert.alert("Demasiados archivos", "Puedes adjuntar hasta 8 archivos por pago.")
      return
    }
    const siguientes = resultado.assets.slice(0, cupo).map((asset) => ({
      key: asset.uri,
      uri: asset.uri,
      nombre: asset.name || "documento.pdf",
      esPdf: asset.mimeType === "application/pdf" || /\.pdf$/i.test(asset.name ?? ""),
    }))
    await leerCapturas(siguientes)
  }

  async function leerCapturas(siguientes: CapturaNueva[]) {
    setFotosNuevas((actuales) => [...actuales, ...siguientes].slice(0, 8))
    setPaso("leyendo")
    setLecturaFallida(false)
    setAvisoLectura(null)
    const lecturas: Lectura[] = []
    const motivos: Array<"sin_datos" | "sin_red" | "servicio"> = []
    const textos = new Map<string, string>()
    try {
      for (let indice = 0; indice < siguientes.length; indice++) {
        if (indice > 0) await esperar(1100)
        const foto = siguientes[indice]
        if (!foto) continue
        const resultadoFoto = foto.esPdf ? await leerPdf(foto.uri) : await leerFoto(foto.uri, foto.ancho)
        textos.set(foto.key, resultadoFoto.texto)
        if (resultadoFoto.ok) lecturas.push(resultadoFoto.lectura)
        else motivos.push(resultadoFoto.motivo)
      }
      setTextosLeidos((actuales) => new Map([...actuales, ...textos]))
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
      setAvisoLectura("No pude leer el monto en este documento.")
    } finally {
      setPaso("confirmar")
    }
  }

  function emparejar(folio: string, valor: number) {
    const candidato = foliosCandidatos.find((item) => item.folio === folio)
    setDocumentos((actuales) => [
      ...actuales,
      {
        key: `par-${folio}-${Date.now()}`,
        folio,
        fecha: candidato?.fecha ?? "",
        monto: formatMontoInput(valor),
        tipo: candidato?.tipo ?? "factura",
      },
    ])
    setFolioActivo(null)
  }

  useEffect(() => {
    if (pago || camaraAbierta.current) return
    camaraAbierta.current = true
    void elegirCapturas("camara")
  }, [pago])

  async function onGuardar() {
    const montoNumero = montoEfectivo
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      Alert.alert("Falta la fecha", "Indica la fecha del pago.")
      return
    }
    if (montoNumero <= 0) {
      setCorrigiendo(true)
      Alert.alert("Falta el total", "Empareja un folio con su monto o escribe el total.")
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
        fotosNuevas: fotosNuevas.map((foto) => ({
          uri: foto.uri,
          nombre: foto.nombre,
          texto: textosLeidos.get(foto.key),
        })),
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
  const foliosDisponibles = foliosCandidatos.filter(
    (candidato) => !documentos.some((documento) => documento.folio === candidato.folio),
  )
  const sumaDocumentos = documentosParaCuadre.reduce((total, documento) => total + documento.monto, 0)
  const montoEfectivo = !montoManual && sumaDocumentos > 0 ? sumaDocumentos : parseCLP(monto) ?? 0
  const puedeConfirmar = montoEfectivo > 0
  const capturaPrincipal = fotosNuevas[fotosNuevas.length - 1]
  const fotoPrincipal = capturaPrincipal?.uri ?? fotosGuardadas[0]?.uri
  const nombrePrincipal = capturaPrincipal?.nombre ?? fotosGuardadas[0]?.nombre ?? ""
  const pdfPrincipal = capturaPrincipal?.esPdf ?? /\.pdf$/i.test(nombrePrincipal)
  const textoLeido = capturaPrincipal ? textosLeidos.get(capturaPrincipal.key) : fotosGuardadas[0]?.texto

  if (paso === "capturar") {
    return (
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={estilos.titulo}>Capturar pago</Text>
        <Text style={estilos.version}>versión 16</Text>
        <Text style={estilos.ayuda}>
          Fotografía la boleta o la pantalla del pago. La app lee el monto y los folios, comprueba que sumen el cargo y te pide confirmar.
        </Text>
        <Text style={estilos.ayuda}>Hace falta internet: la captura se envía a OCR.space para leerla.</Text>
        <Boton titulo="Tomar foto" onPress={() => elegirCapturas("camara")} />
        <Boton titulo="Adjuntar captura" variante="secundario" onPress={() => elegirCapturas("galeria")} />
        <Boton titulo="Subir archivo o PDF" variante="secundario" onPress={() => void elegirArchivos()} />
        <Boton titulo="Cancelar" variante="secundario" onPress={onCancelar} />
      </ScrollView>
    )
  }

  if (paso === "leyendo") {
    return (
      <View style={estilos.leyendo}>
        <Vista uri={fotoPrincipal} nombre={nombrePrincipal} esPdf={pdfPrincipal} />
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
            : "Falta el total. Empareja un folio con su monto o escríbelo abajo."}
        </Text>
        {avisoLectura ? <Text style={[estilos.aviso, lecturaFallida && estilos.avisoError]}>{avisoLectura}</Text> : null}
        <Vista uri={fotoPrincipal} nombre={nombrePrincipal} esPdf={pdfPrincipal} />

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

        <Text style={estilos.seccion}>Documentos</Text>
        {documentos.length === 0 ? (
          <Text style={estilos.ayuda}>
            {foliosCandidatos.length > 0 ? "Todavía no has emparejado ningún folio." : "Esta captura no trae folios."}
          </Text>
        ) : null}
        {documentos.map((documento) => (
          <View key={`par-${documento.key}`} style={estilos.par}>
            <View style={estilos.flex}>
              <Text style={estilos.documentoTitulo}>{documento.folio || "Sin folio"}</Text>
              <Text style={estilos.ayuda}>{etiquetaTipo(documento.tipo)}</Text>
            </View>
            <Text style={estilos.documentoTitulo}>{formatCLP(parseCLP(documento.monto) ?? 0)}</Text>
            <Pressable onPress={() => setDocumentos((actuales) => actuales.filter((item) => item.key !== documento.key))}>
              <Text style={estilos.quitar}>Quitar</Text>
            </Pressable>
          </View>
        ))}

        {foliosDisponibles.length > 0 ? (
          <View style={estilos.emparejar}>
            <Text style={estilos.documentoTitulo}>Emparejar</Text>
            <Text style={estilos.ayuda}>
              {folioActivo
                ? `Folio ${folioActivo} elegido. Ahora toca su monto.`
                : "Toca un folio y después el monto que le corresponde."}
            </Text>
            <View style={estilos.chips}>
              {foliosDisponibles.map((candidato) => (
                <Pressable
                  key={`libre-${candidato.folio}`}
                  onPress={() => setFolioActivo((actual) => (actual === candidato.folio ? null : candidato.folio))}
                  style={[estilos.chip, folioActivo === candidato.folio && estilos.chipActivo]}
                >
                  <Text style={[estilos.chipTexto, folioActivo === candidato.folio && estilos.chipTextoActivo]}>
                    {candidato.folio}
                  </Text>
                </Pressable>
              ))}
            </View>
            {folioActivo ? (
              <View style={estilos.chips}>
                {montosCandidatos.map((candidato) => (
                  <Pressable
                    key={`valor-${candidato.valor}-${candidato.etiqueta}`}
                    onPress={() => emparejar(folioActivo, candidato.valor)}
                    style={estilos.chip}
                  >
                    <Text style={estilos.chipTexto}>{formatCLP(candidato.valor)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {corrigiendo ? <Text style={estilos.seccion}>Corregir documentos</Text> : null}
        {documentos.map((documento) =>
          corrigiendo ? (
            <View key={documento.key} style={estilos.documento}>
              <View style={estilos.documentoCabeza}>
                <Text style={estilos.documentoTitulo}>{documento.folio || "Sin folio"}</Text>
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
          ) : null,
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

        <PanelTotal monto={montoEfectivo} documentos={documentosParaCuadre} />
        {documentos.length === 0 || corrigiendo ? (
          <Campo etiqueta="Total del cargo">
            <TextInput
              value={monto}
              onChangeText={(valor) => {
                setMontoManual(true)
                setMonto(valor)
              }}
              onBlur={() => {
                const valor = parseCLP(monto)
                if (valor != null) setMonto(formatMontoInput(valor))
              }}
              keyboardType="number-pad"
              placeholder="Monto"
              placeholderTextColor="#8B938C"
              style={estilos.input}
            />
          </Campo>
        ) : null}

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
        {textoLeido ? (
          <>
            <Boton
              titulo={verTexto ? "Ocultar texto leído" : "Ver texto leído"}
              variante="secundario"
              onPress={() => setVerTexto((actual) => !actual)}
            />
            {verTexto ? (
              <View style={estilos.archivo}>
                <Text selectable style={estilos.textoOcr}>
                  {textoLeido}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
        <View style={estilos.acciones}>
          <Boton titulo="Otra captura" variante="secundario" onPress={() => elegirCapturas("galeria")} disabled={guardando} />
          <Boton titulo="Tomar otra foto" variante="secundario" onPress={() => elegirCapturas("camara")} disabled={guardando} />
        </View>
        <Boton titulo="Sumar archivo o PDF" variante="secundario" onPress={() => void elegirArchivos()} disabled={guardando} />
        <Boton
          titulo={guardando ? "Guardando…" : pago ? "Guardar cambios" : "Confirmar pago"}
          onPress={() => void onGuardar()}
          disabled={guardando || !puedeConfirmar}
        />
        <Boton titulo="Cancelar" variante="secundario" onPress={onCancelar} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Vista({ uri, nombre, esPdf }: { uri?: string; nombre: string; esPdf: boolean }) {
  if (!uri) return null
  if (esPdf) {
    return (
      <View style={estilos.archivo}>
        <Text style={estilos.documentoTitulo}>{nombre || "Documento PDF"}</Text>
        <Text style={estilos.ayuda}>Archivo adjunto a este pago.</Text>
      </View>
    )
  }
  return <Image source={{ uri }} style={estilos.fotoGrande} />
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
  par: {
    alignItems: "center",
    backgroundColor: colores.tarjeta,
    borderRadius: 14,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  archivo: {
    backgroundColor: colores.tarjeta,
    borderRadius: 14,
    gap: 4,
    padding: 14,
  },
  textoOcr: { color: colores.tinta, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 12, lineHeight: 17 },
  emparejar: {
    backgroundColor: colores.tarjeta,
    borderRadius: 14,
    gap: 8,
    padding: 12,
  },
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
