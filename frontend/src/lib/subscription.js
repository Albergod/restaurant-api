"use client"

import { useState, useEffect } from "react"
import { billingApi, getRole } from "@/lib/api"

// Estados que bloquean la operación (ver backend: subscription_state).
export const BLOCKED_STATES = ["expired", "suspended", "cancelled"]

export function useSubscription() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const role = getRole()
    if (!role || role === "customer" || role === "superadmin") {
      setLoading(false)
      return
    }
    let cancelled = false
    billingApi
      .status()
      .then((s) => !cancelled && setStatus(s))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const state = status?.display_state || null
  return { status, state, loading, blocked: !!state && BLOCKED_STATES.includes(state) }
}
