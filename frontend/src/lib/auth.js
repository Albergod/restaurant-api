"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getToken, getRole } from "./api"

export function useAuth(allowedRoles) {
  const router = useRouter()

  useEffect(() => {
    const token = getToken()
    if (!token) {
      router.replace("/login")
      return
    }
    if (allowedRoles) {
      const role = getRole()
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
      if (!roles.includes(role)) {
        router.replace("/login")
      }
    }
  }, [allowedRoles, router])
}

export function useRedirectIfAuthenticated() {
  const router = useRouter()

  useEffect(() => {
    const token = getToken()
    if (token) {
      const role = getRole()
      const destinations = {
        admin: "/admin",
        waiter: "/waiter",
        kitchen: "/kitchen",
      }
      router.replace(destinations[role] || "/login")
    }
  }, [router])
}
