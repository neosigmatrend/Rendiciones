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

## App Store, paso 1

La app que se instala desde Expo Go no entra a la tienda. El identificador ya quedó fijado en `com.neosigmatrend.rendiciones`. No se cambia después del primer build.

En el Mac, con la cuenta de Apple Developer ya pagada:

```bash
cd ~/Desktop/Proyectos/Rendiciones
git pull
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform ios --profile production
```

`login` pide la cuenta de Expo. `init` crea el proyecto en Expo y guarda el identificador en `app.json`. `build` pide la cuenta de Apple Developer, firma la app en la nube y deja un binario listo para TestFlight. El resultado no se instala con el QR de Expo Go.

## Folio para la cartola

Cada pago muestra el folio con el formato de la planilla del banco y la exportación lo trae en la columna `folio_banco`:

- `FA 2342355245` una factura
- `FA 564698-09090993` varias facturas
- `BOL 2310943094` una boleta
- `BOL 1231231212-345345345` varias boletas
- el texto tal cual cuando el documento es de tipo Otro (invoice de compras internacionales)

## Conciliar con la cartola, en el Mac

En la raíz del repositorio hay una versión web del mismo proyecto. Ahí vive la página que cruza la cartola del banco con los pagos del teléfono:

```bash
cd ~/Desktop/Proyectos/Rendiciones
npm install
npm run dev
```

Abre http://localhost:3847/conciliar. El trabajo es pegar y copiar:

1. En Excel copias desde la fila de títulos (FECHA, DESCRIPCION, MONTO…) hasta el último movimiento y lo pegas en el primer recuadro.
2. Cargas el `rendicion.csv` que exportas desde el teléfono, o usas los pagos guardados en ese computador.
3. La página empareja por monto y fecha, deja `RENDICION` en los movimientos con respaldo, `PTC` en los pagos de la tarjeta, el folio en tu formato y una observación cuando algo necesita revisión. El botón copia las tres columnas y las pegas en la columna CATEGORIA de tu planilla.

Cada fila tiene una lista para cambiar el pago a mano, y abajo aparecen los pagos de la app que no encontraron movimiento. Nada se sube a internet: la página corre en el computador.

La app para usar al pagar sigue siendo la de Expo Go.
