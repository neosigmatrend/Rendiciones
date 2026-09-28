# Rendiciones

App para el teléfono. Al pagar, tomas o adjuntas la captura de la pantalla. La app lee el monto y los folios, comprueba que sumen el cargo y pide confirmación.

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

La captura se envía a OCR.space para leerla. El teléfono necesita internet. Si la lectura no cuadra, se corrige antes de confirmar. Si no logra leerla, la foto queda y esos datos se completan en la confirmación.

## Web

En la raíz del repositorio también hay una versión web (`npm run dev`, puerto 3847). La app para usar al pagar es la de Expo Go.
