"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useRedirectIfAuthenticated } from "@/lib/auth"
import { API_URL } from "@/lib/api"
import { UtensilsCrossed, Eye, EyeOff, AlertCircle, LogIn, ChefHat } from "lucide-react"

export default function LoginPage() {
  useRedirectIfAuthenticated()
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleLogin() {
    if (!username || !password) {
      setError("Completá todos los campos")
      return
    }
    setError("")
    setLoading(true)
    try {
      const form = new URLSearchParams()
      form.append("username", username)
      form.append("password", password)
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || "Error al iniciar sesión")
      }
      const data = await res.json()
      localStorage.setItem("token", data.access_token)
      localStorage.setItem("role", data.role)
      const destinations = {
        admin: "/admin",
        waiter: "/waiter",
        kitchen: "/kitchen",
      }
      router.replace(destinations[data.role] || "/login")
    } catch (err) {
      setError("Usuario o contraseña incorrectos")
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleLogin()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 relative overflow-hidden selection:bg-amber-500/30">
      {/* Background abstract elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-amber-500/20 blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-orange-600/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>

      <div className="w-full max-w-md z-10 animate-fade-in">
        <div className="mb-10 text-center animate-slide-up">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl shadow-orange-500/20">
            <ChefHat className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">Staff Portal</h1>
          <p className="mt-2 text-gray-400 font-medium">Ingresa para gestionar el restaurante</p>
        </div>

        <div className="glass-dark rounded-3xl p-8 sm:p-10 animate-slide-up" style={{ animationDelay: '100ms' }}>
          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-300">
                Email
              </label>
              <input
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="tu@email.com"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-white outline-none transition-all placeholder:text-gray-600 focus:border-amber-400/50 focus:bg-white/10 focus:ring-4 focus:ring-amber-400/10"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-300">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 pr-12 text-white outline-none transition-all placeholder:text-gray-600 focus:border-amber-400/50 focus:bg-white/10 focus:ring-4 focus:ring-amber-400/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            
            <div className="pt-2">
              <button
                onClick={handleLogin}
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-4 text-sm font-bold text-white transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-orange-500/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verificando...
                  </span>
                ) : (
                  <>
                    <LogIn className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                    Entrar al sistema
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center animate-fade-in" style={{ animationDelay: '300ms' }}>
          <p className="text-sm font-medium text-gray-500 bg-black/40 inline-flex px-4 py-2 rounded-full border border-white/5 backdrop-blur-sm">
            Clientes: Por favor, escanea el código QR de tu mesa
          </p>
        </div>
      </div>
    </div>
  )
}
