# Rendiciones

App para el teléfono. Al pagar, tomas o adjuntas la captura de la pantalla. La app lee el monto y los folios, comprueba que sumen el cargo y pide confirmación.

## En el Mac

Igual que Ruta viva. Una sola vez:

```bash
cd ~/Desktop/Proyectos
git clone https://github.com/neosigmatrend/Rendiciones.git
cd Rendiciones/mobile
npm install
npx expo start
```

El teléfono y el Mac en la misma red Wi-Fi. Escanea el QR con Expo Go.

## Actualizar

Cuando haya un cambio, detén Expo con `Ctrl+C` y ejecuta un solo comando:

```bash
cd ~/Desktop/Proyectos/Rendiciones/mobile
npm run actualizar
```

Baja lo nuevo de GitHub, instala lo que falte y levanta Expo con la caché limpia. Escanea el QR otra vez. La primera pantalla muestra el número de versión, así sabes si el teléfono cargó el cambio.

No se baja otro ZIP y no se cambia de carpeta.

Los pagos quedan guardados en el teléfono. Agrosuper, Gasco y Aguas Andinas aparecen como ejemplos la primera vez.

La captura se envía a OCR.space para leerla. El teléfono necesita internet. Si la lectura no cuadra, se corrige antes de confirmar. Si no logra leerla, la foto queda y esos datos se completan en la confirmación.

## Web

En la raíz del repositorio también hay una versión web (`npm run dev`, puerto 3847). La app para usar al pagar es la de Expo Go.
