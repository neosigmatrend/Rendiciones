import assert from "node:assert/strict"
import { folioBanco } from "./format.ts"

assert.equal(folioBanco([]), "")
assert.equal(folioBanco([{ folio: "2342355245", tipo: "factura" }]), "FA 2342355245")
assert.equal(
  folioBanco([
    { folio: "564698", tipo: "factura" },
    { folio: "09090993", tipo: "factura" },
  ]),
  "FA 564698-09090993",
)
assert.equal(folioBanco([{ folio: "2310943094", tipo: "boleta" }]), "BOL 2310943094")
assert.equal(
  folioBanco([
    { folio: "1231231212", tipo: "boleta" },
    { folio: "345345345", tipo: "boleta" },
  ]),
  "BOL 1231231212-345345345",
)
assert.equal(
  folioBanco([
    { folio: "15433307", tipo: "factura" },
    { folio: "15433323", tipo: "factura" },
    { folio: "15433322", tipo: "factura" },
  ]),
  "FA 15433307-15433323-15433322",
)
assert.equal(folioBanco([{ folio: "INV-2026-0091", tipo: "otro" }]), "INV-2026-0091")
assert.equal(
  folioBanco([
    { folio: "181176", tipo: "factura" },
    { folio: "445566", tipo: "boleta" },
  ]),
  "FA 181176 BOL 445566",
)
assert.equal(folioBanco([{ folio: "  ", tipo: "factura" }]), "")
assert.equal(
  folioBanco([
    { folio: "181176", tipo: "factura" },
    { folio: "181176", tipo: "factura" },
  ]),
  "FA 181176",
)

console.log("folio banco ok")
