import { describe, it, expect } from "vitest"
import {
  formatPrice,
  parsePriceInput,
  formatPriceInput,
  normalizeCurrency,
} from "./money"

// Issue auditoría: precios colombianos sin ".00" y sin el accidente
// del punto de miles ("10.000" tecleado → 10000, no 10).

describe("normalizeCurrency", () => {
  it("defaultea a COP ante cualquier valor raro", () => {
    expect(normalizeCurrency("COP")).toBe("COP")
    expect(normalizeCurrency("USD")).toBe("USD")
    expect(normalizeCurrency("usd")).toBe("COP")
    expect(normalizeCurrency(undefined)).toBe("COP")
    expect(normalizeCurrency("EUR")).toBe("COP")
  })
})

describe("formatPrice", () => {
  const noNbsp = (s) => s.replace(/\s/g, " ")
  it("COP sin decimales ni formato dólar", () => {
    expect(noNbsp(formatPrice(12000, "COP"))).toBe("$ 12.000")
    // Sin centavos estilo dólar ("$12000.00"); el ".000" de miles sí vale.
    expect(formatPrice(12000, "COP")).not.toMatch(/\.\d{2}\b/)
    expect(formatPrice(10000, "COP")).toContain("10.000")
    expect(formatPrice(1000000, "COP")).toContain("1.000.000")
  })
  it("COP redondea centavos (no existen en pesos)", () => {
    expect(formatPrice(19999.99, "COP")).toBe(formatPrice(20000, "COP"))
  })
  it("USD conserva 2 decimales", () => {
    expect(formatPrice(19.99, "USD")).toBe("$19.99")
    expect(formatPrice(10, "USD")).toBe("$10.00")
  })
  it("aguanta basura sin romper", () => {
    expect(formatPrice(null, "COP")).toContain("0")
    expect(formatPrice(undefined, "COP")).toContain("0")
    expect(formatPrice("25000", "COP")).toContain("25.000")
  })
})

describe("parsePriceInput", () => {
  it("COP: el punto de miles se ignora (el accidente de la auditoría)", () => {
    expect(parsePriceInput("10.000", "COP")).toBe(10000)
    expect(parsePriceInput("50.000", "COP")).toBe(50000)
    expect(parsePriceInput("1.000.000", "COP")).toBe(1000000)
    expect(parsePriceInput("12000", "COP")).toBe(12000)
  })
  it("COP: vacío o basura → null", () => {
    expect(parsePriceInput("", "COP")).toBeNull()
    expect(parsePriceInput("   ", "COP")).toBeNull()
    expect(parsePriceInput("abc", "COP")).toBeNull()
  })
  it("USD: decimales con punto funcionan", () => {
    expect(parsePriceInput("10.00", "USD")).toBe(10)
    expect(parsePriceInput("9.99", "USD")).toBe(9.99)
    expect(parsePriceInput("", "USD")).toBeNull()
  })
})

describe("formatPriceInput", () => {
  it("COP agrupa miles mientras se escribe", () => {
    expect(formatPriceInput(12000, "COP")).toBe("12.000")
    expect(formatPriceInput(1000000, "COP")).toBe("1.000.000")
    expect(formatPriceInput("", "COP")).toBe("")
  })
  it("round-trip: lo mostrado se parsea al mismo número", () => {
    for (const n of [0, 8000, 12000, 25000, 280000, 1000000]) {
      expect(parsePriceInput(formatPriceInput(n, "COP"), "COP")).toBe(n)
    }
  })
  it("USD no reformatea (no roba el punto decimal al escribir)", () => {
    expect(formatPriceInput("9.9", "USD")).toBe("9.9")
  })
})
