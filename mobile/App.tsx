import { useEffect, useState } from "react"
import { BackHandler, StyleSheet, View } from "react-native"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import { PagosProvider, usePagos } from "./src/contexto"
import { Detalle } from "./src/Detalle"
import { Formulario, type ModoNuevo } from "./src/Formulario"
import { Lista } from "./src/Lista"
import { colores } from "./src/ui"

type Pantalla =
  | { nombre: "lista" }
  | { nombre: "nuevo"; modo: ModoNuevo }
  | { nombre: "detalle"; id: string }
  | { nombre: "editar"; id: string }

function Navegacion() {
  const { pagos } = usePagos()
  const [pila, setPila] = useState<Pantalla[]>([{ nombre: "lista" }])
  const actual = pila[pila.length - 1]
  const tarjetas = [...new Set(pagos.map((pago) => pago.tarjeta))]

  function ir(pantalla: Pantalla) {
    setPila((actuales) => [...actuales, pantalla])
  }

  function volver() {
    setPila((actuales) => (actuales.length > 1 ? actuales.slice(0, -1) : actuales))
  }

  function reemplazar(pantalla: Pantalla) {
    setPila((actuales) => [...actuales.slice(0, -1), pantalla])
  }

  useEffect(() => {
    const suscripcion = BackHandler.addEventListener("hardwareBackPress", () => {
      if (pila.length > 1) {
        volver()
        return true
      }
      return false
    })
    return () => suscripcion.remove()
  }, [pila.length])

  return (
    <SafeAreaView style={estilos.pantalla} edges={["top", "left", "right"]}>
      {actual.nombre === "lista" ? <Lista onAbrir={(id) => ir({ nombre: "detalle", id })} onNuevo={(modo) => ir({ nombre: "nuevo", modo })} /> : null}
      {actual.nombre === "nuevo" ? (
        <Formulario
          modo={actual.modo}
          tarjetas={tarjetas}
          onCancelar={volver}
          onGuardado={(id) => reemplazar({ nombre: "detalle", id })}
        />
      ) : null}
      {actual.nombre === "detalle" ? (
        <Detalle
          id={actual.id}
          onVolver={volver}
          onEditar={() => ir({ nombre: "editar", id: actual.id })}
          onEliminado={() => setPila([{ nombre: "lista" }])}
        />
      ) : null}
      {actual.nombre === "editar" ? (
        <Formulario
          pago={pagos.find((pago) => pago.id === actual.id)}
          tarjetas={tarjetas}
          onCancelar={volver}
          onGuardado={() => volver()}
        />
      ) : null}
    </SafeAreaView>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PagosProvider>
        <View style={estilos.pantalla}>
          <Navegacion />
          <StatusBar style="dark" />
        </View>
      </PagosProvider>
    </SafeAreaProvider>
  )
}

const estilos = StyleSheet.create({
  pantalla: { backgroundColor: colores.fondo, flex: 1 },
})
