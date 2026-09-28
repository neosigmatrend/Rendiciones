# Rendiciones

Registro de pagos con tarjeta para armar la rendición del mes. Cada pago guarda la captura de la pantalla y las facturas o boletas que lo componen. Varios documentos pueden sumar un solo cargo, como en un pago de Agrosuper o Gasco.

## Qué hace

- Registrar el pago en el momento: fecha, proveedor, monto, tarjeta y captura.
- Agregar uno o más folios. La suma se compara con el monto del cargo.
- Dejar el folio pendiente si la factura o la boleta todavía no está.
- Exportar la rendición del mes en CSV, lista para abrir en Excel.

Mercado Libre y Mercado Pago quedan fuera de esta versión.

## Cómo correrlo

```bash
npm install
npm run dev
```

La app queda en [http://127.0.0.1:3847](http://127.0.0.1:3847).

Los pagos y las capturas se guardan en `data/` en este equipo. Esa carpeta no se versiona.
