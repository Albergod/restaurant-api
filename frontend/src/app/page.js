"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getToken, getRole } from "@/lib/api"
import { ChefHat, ArrowRight } from "lucide-react"

export default function Home() {
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-amber-500/20 blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-orange-600/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>

      <div className="z-10 text-center">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl shadow-orange-500/20">
          <ChefHat className="h-12 w-12 text-white" />
        </div>
        <h1 className="text-5xl font-black text-white tracking-tight mb-3">Restaurant Manager</h1>
        <p className="text-lg text-gray-400 mb-10">Gestión de pedidos, menú y cocina</p>
        <button
          onClick={() => router.push("/login")}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-4 text-base font-bold text-white transition-all hover:scale-105 hover:shadow-lg hover:shadow-orange-500/25 active:scale-95"
        >
          Iniciar sesión
          <ArrowRight className="h-5 w-5" />
        </button>
        <p className="mt-12 text-sm text-gray-600">
          Clientes: escaneá el código QR de tu mesa
        </p>
      </div>
    </div>
  )
}
