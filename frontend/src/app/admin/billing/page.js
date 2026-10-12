"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { billingApi } from "@/lib/api"
import {
  CreditCard,
  Check,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
  X,
} from "lucide-react"

const PLANS = [
  { id: "basic", name: "Básico", desc: "Para restaurantes que empiezan", features: ["Menú digital por QR", "Pedidos en tiempo real", "Chat con clientes", "Panel de cocina y meseros"] },
  { id: "pro", name: "Pro", desc: "Para operar a toda marcha", features: ["Todo lo del Básico", "Promociones y destacados", "Historial y reportes", "Soporte prioritario"] },
]

function usd(cents) {
  return `USD ${(cents / 100).toFixed(2)}`
}

export default function BillingPage() {
  const router = useRouter()
  const [config, setConfig] = useState(null)
  const [status, setStatus] = useState(null)
  const [cycle, setCycle] = useState("monthly")
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [trialMsg, setTrialMsg] = useState(null)
  const [lastTransaction, setLastTransaction] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem("role") : null
    if (role !== "admin" && role !== "superadmin") {
      router.replace("/login")
      return
    }
    load()
    return () => stopPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    try {
      setLoading(true)
      const [cfg, st] = await Promise.all([billingApi.config(), billingApi.status()])
      setConfig(cfg)
      setStatus(st)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar facturación")
    } finally {
      setLoading(false)
    }
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  function loadPaddleJs(env) {
    return new Promise((resolve, reject) => {
      if (window.Paddle) return resolve()
      const s = document.createElement("script")
      s.src = "https://cdn.paddle.com/paddle/v2/paddle.js"
      s.onload = () => resolve()
      s.onerror = () => reject(new Error("No se pudo cargar Paddle.js"))
      document.head.appendChild(s)
    })
  }

  async function verifyPayment() {
    if (!lastTransaction) return
    setVerifying(true)
    setError(null)
    try {
      const res = await billingApi.paddleTransaction(lastTransaction)
      if (res.approved) {
        const st = await billingApi.status()
        setStatus(st)
        setSuccess(true)
      } else {
        setError(`Pago aún no confirmado (estado: ${res.status || "pendiente"}). Intenta de nuevo en unos segundos.`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo verificar el pago")
    } finally {
      setVerifying(false)
    }
  }

  async function startTrial() {    if (!status?.restaurant_id) return
    setError(null)
    setTrialMsg(null)
    try {
      const res = await billingApi.startTrial(status.restaurant_id)
      setTrialMsg(`Prueba activa hasta ${new Date(res.trial_ends_at).toLocaleDateString()}`)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo activar la prueba")
    }
  }

  async function pay(plan) {
    setError(null)
    setSuccess(false)
    setPaying(true)
    try {
      const { transaction_id, checkout_url } = await billingApi.paddleCheckout(plan, cycle)
      await loadPaddleJs(config?.paddle_env)
      window.Paddle.Initialize({
        token: config.paddle_client_token,
        environment: config.paddle_env === "production" ? "production" : "sandbox",
        eventCallback: (event) => {
          if (event?.name === "checkout.closed") {
            setPaying(false)
            stopPolling()
          }
        },
      })
      window.Paddle.Checkout.open({ transactionId: transaction_id })
      setLastTransaction(transaction_id)
      // Polling corto: el webhook activa en segundos; luego el usuario
      // verifica manual (evita quemar DB 5 min por pagador).
      stopPolling()
      let tries = 0
      pollRef.current = setInterval(async () => {
        tries += 1
        try {
          const st = await billingApi.status()
          if (st.subscription_status === "active") {
            stopPolling()
            setStatus(st)
            setSuccess(true)
            setPaying(false)
          } else if (tries >= 15) {
            stopPolling()
            setPaying(false)
          }
        } catch {
          if (tries >= 15) {
            stopPolling()
            setPaying(false)
          }
        }
      }, 4000)
      if (!config.paddle_client_token && checkout_url) {
        window.location.href = checkout_url
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el pago")
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    )
  }

  const isActive = status?.subscription_status === "active"
  const isTrialing = status?.subscription_status === "trialing"

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Facturación</h1>
      <p className="text-sm text-gray-500 mb-6">Paga tu suscripción con tarjeta internacional vía Paddle</p>

      {error && (
        <div className="flex items-start gap-2 p-4 mb-4 rounded-xl bg-red-50 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="break-all">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="p-4 mb-4 rounded-xl bg-green-50 text-green-700 text-sm font-semibold">
          ¡Pago confirmado! Tu suscripción está activa.
        </div>
      )}
      {trialMsg && (
        <div className="p-4 mb-4 rounded-xl bg-green-50 text-green-700 text-sm font-semibold">{trialMsg}</div>
      )}

      <div className="p-4 mb-6 rounded-xl bg-gray-50 text-sm flex items-center gap-2 flex-wrap">
        <Clock className="w-5 h-5 text-gray-400" />
        Estado actual:{" "}
        <strong className="capitalize">{status?.subscription_status}</strong>
        {status?.current_period_end && (
          <span className="text-gray-500">
            · vigente hasta {new Date(status.current_period_end).toLocaleDateString()}
          </span>
        )}
        {status?.trial_ends_at && isTrialing && (
          <span className="text-gray-500">
            · prueba hasta {new Date(status.trial_ends_at).toLocaleDateString()}
          </span>
        )}
        {lastTransaction && !success && (
          <button
            onClick={verifyPayment}
            disabled={verifying}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Ya pagué, verificar
          </button>
        )}
      </div>

      {status?.restaurant_slug === "demo" ? (
        <div className="p-4 mb-6 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-sm">
          <strong>Modo demo.</strong> Los pagos están desactivados aquí: nada de lo que hagas es real.
        </div>
      ) : (
      <>
      {status?.subscription_status === "trialing" && !status?.trial_ends_at && (
        <button
          onClick={startTrial}
          className="mb-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-100 text-amber-800 font-semibold text-sm hover:bg-amber-200"
        >
          <Sparkles className="w-4 h-4" />
          Activar 14 días de prueba gratis
        </button>
      )}

      {!config?.paddle_available ? (
        <div className="p-4 rounded-xl bg-yellow-50 text-yellow-800 text-sm">
          El pago internacional aún no está configurado. Contacta al administrador.
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-6">
            {["monthly", "biweekly"].map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                  cycle === c ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {c === "monthly" ? "Mensual" : "Quincenal"}
                {config?.cycles?.[c] && (
                  <span className="block text-xs font-normal opacity-80">
                    {usd(config.cycles[c].cents_usd)} / {config.cycles[c].days} días
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {PLANS.map((plan) => (
              <div key={plan.id} className="border rounded-2xl p-6 flex flex-col">
                <h2 className="text-lg font-bold">{plan.name}</h2>
                <p className="text-sm text-gray-500 mb-1">{plan.desc}</p>
                <p className="text-2xl font-bold mb-4">
                  {config?.cycles?.[cycle] ? usd(config.cycles[cycle].cents_usd) : "—"}
                  <span className="text-sm font-normal text-gray-500">
                    {" "}/ {cycle === "monthly" ? "mes" : "15 días"}
                  </span>
                </p>
                <ul className="space-y-2 text-sm mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => pay(plan.id)}
                  disabled={paying}
                  className="mt-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  Pagar con tarjeta
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Pagos procesados por Paddle (Merchant of Record). Al pagar aceptas sus términos.
          </p>
        </>
      )}
      </>
      )}
    </div>
  )
}
