"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { API_URL } from "@/lib/api"
import { ChefHat, ArrowRight, ArrowLeft, Loader2, AlertCircle, LayoutDashboard } from "lucide-react"

const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL || "demo@restaurant.com"
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "demo1234"

export default function DemoPage() {
  const router = useRouter()
  const [demo, setDemo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [entering, setEntering] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/api/restaurants/demo/overview`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Demo no disponible por ahora"))))
      .then(setDemo)
      .catch((e) => setError(e instanceof Error ? e.message : "Demo no disponible"))
      .finally(() => setLoading(false))
  }, [])

  async function enterPanel() {
    setEntering(true)
    setError("")
    try {
      const form = new URLSearchParams()
      form.append("username", DEMO_EMAIL)
      form.append("password", DEMO_PASSWORD)
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      })
      if (!res.ok) throw new Error("El panel demo no está disponible ahora mismo")
      const data = await res.json()
      localStorage.setItem("token", data.access_token)
      localStorage.setItem("role", data.role)
      router.replace("/admin")
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo entrar al panel demo")
    } finally {
      setEntering(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>

        <div className="text-center mb-8">
          <p className="inline-block text-xs font-semibold tracking-wide text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-1.5 mb-4">
            DEMO EN VIVO · DATOS FICTICIOS
          </p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            Así se ve tu restaurante
          </h1>
          <p className="text-gray-400 mt-2">Esto verían tus clientes al escanear tu QR.</p>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        )}

        {error && !loading && (
          <p className="flex items-center justify-center gap-2 text-sm text-red-400 py-16">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}

        {demo && (
          <>
            <div className="rounded-2xl bg-white text-gray-900 overflow-hidden mb-6">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
                    <ChefHat className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-black text-xl leading-tight">{demo.restaurant.name}</h2>
                    <p className="text-xs text-white/80">Menú digital · siempre actualizado</p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-5">
                {demo.categories.map((cat) => (
                  <div key={cat.id}>
                    <h3 className="font-bold text-sm uppercase tracking-wide text-gray-500 mb-2">{cat.name}</h3>
                    <div className="space-y-2">
                      {cat.products.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
                          <div>
                            <p className="font-semibold text-sm">{p.name}</p>
                            {p.description && <p className="text-xs text-gray-500 line-clamp-1">{p.description}</p>}
                          </div>
                          <p className="font-black text-sm text-amber-600 shrink-0">
                            ${Number(p.price).toLocaleString("es-CO")}
                          </p>
                        </div>
                      ))}
                      {cat.products.length === 0 && (
                        <p className="text-xs text-gray-400">Sin platos por aquí todavía.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <button
                onClick={enterPanel}
                disabled={entering}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 font-bold hover:scale-[1.02] transition-transform disabled:opacity-60"
              >
                {entering ? <Loader2 className="h-5 w-5 animate-spin" /> : <LayoutDashboard className="h-5 w-5" />}
                Explorar el panel demo
              </button>
              <button
                onClick={() => router.push("/register")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-600 px-6 py-4 font-bold text-gray-200 hover:border-gray-400 transition-colors"
              >
                Crear el mío gratis <ArrowRight className="h-5 w-5" />
              </button>
            </div>
            <p className="text-center text-xs text-gray-500 mt-3">
              El panel demo usa datos ficticios: pide, confirma y juega sin miedo.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
