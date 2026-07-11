"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiFetch, connectWebSocket } from "@/lib/api"
import {
  MessageSquare,
  Send,
  ChevronLeft,
  AlertCircle,
  Loader2,
} from "lucide-react"

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let reconnectTimeout
    let currentWs

    async function loadHistory() {
      try {
        const session = await apiFetch(`/api/chat/sessions/${sessionId}`)
        if (!cancelled) setMessages(session.messages || [])
      } catch (e) { /* no token = no history */ }
    }

    function connect() {
      const ws = connectWebSocket(sessionId, (msg) => {
        if (!cancelled) setMessages((prev) => [...prev, msg])
      })
      currentWs = ws
      wsRef.current = ws
      ws.onopen = () => {
        if (!cancelled) { setConnected(true); setLoading(false); setError(null) }
      }
      ws.onclose = () => {
        if (!cancelled) { setConnected(false); setLoading(false) }
        reconnectTimeout = setTimeout(() => { if (!cancelled) connect() }, 3000)
      }
      ws.onerror = () => {
        if (!cancelled) setError("Error de conexión")
        setLoading(false)
      }
    }

    loadHistory()
    connect()

    return () => {
      cancelled = true
      clearTimeout(reconnectTimeout)
      if (currentWs) currentWs.close()
    }
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function sendMessage() {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
      return
    wsRef.current.send(input.trim())
    setInput("")
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (error && !loading) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center bg-[#fafafa] p-4">
        <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
        <p className="mb-4 text-sm font-medium text-red-600">{error}</p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-[#fafafa]">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500">
          <MessageSquare className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">Chat</p>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                connected ? "bg-green-500" : "bg-red-400"
              }`}
            />
            <p className="text-xs text-gray-400">
              {connected ? "Conectado" : "Desconectado"}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
          </div>
        )}

        {messages.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageSquare className="mb-3 h-10 w-10 text-gray-200" />
            <p className="text-sm text-gray-400">No hay mensajes aún.</p>
            <p className="text-xs text-gray-300">Escribí algo para comenzar.</p>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((msg, idx) => {
            const isMine =
              msg.sender === "customer" ||
              msg.sender === "client" ||
              msg.role === "customer"
            return (
              <div
                key={idx}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    isMine
                      ? "rounded-br-sm bg-amber-500 text-white"
                      : "rounded-bl-sm border border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words leading-relaxed">
                    {msg.content}
                  </p>
                  <p
                    className={`mt-1 text-[10px] ${
                      isMine ? "text-white/70" : "text-gray-400"
                    }`}
                  >
                    {msg.sent_at || msg.timestamp
                      ? new Date(msg.sent_at || msg.timestamp).toLocaleTimeString("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí un mensaje..."
            disabled={!connected}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!connected || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
