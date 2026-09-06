"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import {
  ChefHat,
  AlertCircle,
  Plus,
  QrCode,
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  Download,
  RefreshCw,
} from "lucide-react"

export default function AdminTablesPage() {
  const router = useRouter()
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ number: "", capacity: 4 })
  const [copiedId, setCopiedId] = useState(null)

  const loadTables = useCallback(async () => {
    try {
      const data = await apiFetch("/api/tables/")
      setTables(Array.isArray(data) ? data : [])
      setError(null)
    } catch (e) {
      if (e.message?.startsWith("401")) {
        router.replace("/login")
        return
      }
      setError("Error al cargar mesas")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { loadTables() }, [loadTables])

  async function saveTable() {
    try {
      await apiFetch("/api/tables/", {
        method: "POST",
        body: JSON.stringify({
          number: Number(form.number),
          capacity: Number(form.capacity),
        }),
      })
      setDialogOpen(false)
      setForm({ number: "", capacity: 4 })
      loadTables()
    } catch (e) {
      setError(e.message?.startsWith("40") ? "Error al guardar" : "Error al guardar mesa")
    }
  }

  async function regenerateQr(tableId) {
    try {
      await apiFetch(`/api/tables/${tableId}/regenerate-qr`, { method: "POST" })
      loadTables()
    } catch (e) {
      setError("Error al regenerar QR")
    }
  }

  function copyQrUrl(qrCode, tableNumber) {
    const url = `${window.location.origin}/menu/${qrCode}`
    navigator.clipboard.writeText(url)
    setCopiedId(tableNumber)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mesas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tables.length} mesa{tables.length !== 1 ? "s" : ""} registrada{tables.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => { setForm({ number: "", capacity: 4 }); setDialogOpen(true) }}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-600 shadow-sm"
        >
          <Plus className="h-5 w-5" />
          Nueva mesa
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
          <ChefHat className="mb-3 h-12 w-12 text-gray-200" />
          <p className="text-sm font-medium text-gray-400">No hay mesas registradas</p>
          <button
            onClick={() => { setForm({ number: "", capacity: 4 }); setDialogOpen(true) }}
            className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
          >
            Agregar primera mesa
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => (
            <div
              key={table.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${
                table.is_occupied ? "border-orange-200" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    table.is_occupied ? "bg-orange-100" : "bg-gray-100"
                  }`}>
                    <ChefHat className={`h-5 w-5 ${table.is_occupied ? "text-orange-600" : "text-gray-400"}`} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">Mesa #{table.number}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Capacidad: {table.capacity}
                    </p>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  table.is_occupied
                    ? "bg-orange-100 text-orange-700"
                    : "bg-green-100 text-green-700"
                }`}>
                  {table.is_occupied ? (
                    <XCircle className="h-3 w-3" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  {table.is_occupied ? "Ocupada" : "Libre"}
                </div>
              </div>

              {table.qr_image && (
                <div>
                  <div className="flex justify-center mb-3">
                    <img
                      src={table.qr_image}
                      alt={`QR Mesa #${table.number}`}
                      className="h-28 w-28 rounded-xl border border-gray-200"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyQrUrl(table.qr_code, table.number)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                    >
                      {copiedId === table.number ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copiar URL
                        </>
                      )}
                    </button>
                    <a
                      href={table.qr_image}
                      download={`mesa-${table.number}.png`}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => regenerateQr(table.id)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDialogOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-slide-up">
            <h3 className="text-lg font-bold text-gray-900">Nueva mesa</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Número de mesa</label>
                <input
                  type="number"
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                  placeholder="Ej: 1, 2, 3..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Capacidad</label>
                <input
                  type="number"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  placeholder="4"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setDialogOpen(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveTable}
                disabled={!form.number}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                Crear mesa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
