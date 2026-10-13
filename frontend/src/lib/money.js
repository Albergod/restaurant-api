/** Moneda de la carta: COP (pesos, sin centavos) o USD.
 *
 * Reglas (issue auditoría: nada de "12000.00"):
 * - COP → "$ 12.000" (es-CO, 0 decimales; en COP no hay centavos).
 * - USD → "$12.00" (en-US, 2 decimales).
 */

export const CURRENCIES = ["COP", "USD"];

export function normalizeCurrency(currency) {
  return currency === "USD" ? "USD" : "COP";
}

export function formatPrice(value, currency = "COP") {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "$ 0";
  if (normalizeCurrency(currency) === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n);
  }
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

/** Convierte lo tecleado en el input a número o null (vacío/inválido).
 * COP: se ignoran los puntos de miles ("10.000" → 10000). Ese era el
 * accidente de la auditoría con el input type=number anterior.
 * USD: se aceptan decimales con punto ("10.00" → 10).
 */
export function parsePriceInput(text, currency = "COP") {
  const t = String(text ?? "").trim();
  if (!t) return null;
  if (normalizeCurrency(currency) === "USD") {
    const n = Number(t.replace(/,/g, ""));
    return Number.isFinite(n) && t.match(/[0-9]/) ? n : null;
  }
  const digits = t.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isSafeInteger(n) ? n : null;
}

/** Lo que se muestra dentro del input mientras se escribe.
 * COP: agrupa miles ("12000" → "12.000"). USD: tal cual.
 */
export function formatPriceInput(value, currency = "COP") {
  if (value === "" || value === null || value === undefined) return "";
  if (normalizeCurrency(currency) === "USD") return String(value);
  const n = typeof value === "number" ? value : parsePriceInput(value, "COP");
  if (n === null || !Number.isFinite(n)) return "";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n);
}
