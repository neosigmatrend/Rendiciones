# Rendiciones

App para el teléfono. Al pagar con tarjeta registras el cargo, adjuntas la captura de la pantalla y anotas las facturas o boletas que suman ese monto.

## Abrirla en Expo Go

1. Instala Expo Go en el teléfono.
2. En esta carpeta `mobile`, ejecuta:

```bash
cd mobile
npm install
npx expo start
```

3. El teléfono y el computador tienen que estar en la misma red Wi-Fi. Escanea el código QR con Expo Go (Android) o con la cámara (iPhone). También puedes pegar la dirección `exp://` que muestra la terminal.

Los pagos quedan guardados en el teléfono. Agrosuper, Gasco y Aguas Andinas aparecen como ejemplos la primera vez.

Al adjuntar la captura, la app la envía a OCR.space para leer el monto y los folios. El teléfono necesita internet. Si no logra leerlos, la foto queda guardada y se completan a mano.

## Web

En la raíz del repositorio también hay una versión web (`npm run dev`, puerto 3847). La app para usar al pagar es la de Expo Go.
