"use client"

import { useEffect, useState } from "react"
import { billingApi, getToken } from "./api"

let cachedCurrency = null

/** Moneda del restaurante logueado (COP por defecto).
 * En vistas públicas (sin token: menú cliente, tracking) devuelve COP,
 * que es la moneda por defecto de todos los restaurantes nuevos.
 */
export function useCurrency() {
  const [currency, setCurrency] = useState(cachedCurrency || "COP")

  useEffect(() => {
    if (cachedCurrency || !getToken()) return
    let cancelled = false
    billingApi
      .status()
      .then((s) => {
        if (!cancelled && s?.currency) {
          cachedCurrency = s.currency
          setCurrency(s.currency)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return currency
}

/** Para tests o tras cambiar la moneda en Facturación. */
export function setCachedCurrency(currency) {
  cachedCurrency = currency
}
