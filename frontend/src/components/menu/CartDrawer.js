"use client"

import { ShoppingCart, Plus, Minus, Trash2, X, Send, Loader } from "lucide-react"

function formatPrice(price) {
  return `$${Number(price).toFixed(2)}`
}

export default function CartDrawer({ cart, cartOpen, cartCount, cartTotal, onClose, onUpdateQty, onUpdateNote, onSubmit, submitting }) {
  if (!cartOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col animate-slide-up overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
        
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 text-orange-500 rounded-xl">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">Tu pedido</h2>
              <p className="text-xs font-medium text-gray-500">{cartCount} {cartCount === 1 ? 'artículo' : 'artículos'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50/50">
          {cart.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center opacity-50">
              <ShoppingCart className="h-16 w-16 mb-4 text-gray-300" />
              <p className="text-gray-500 font-medium text-lg">Tu carrito está vacío</p>
              <p className="text-gray-400 text-sm mt-1">¡Agrega algo delicioso!</p>
              <button onClick={onClose} className="mt-6 text-amber-600 font-bold hover:underline">Volver al menú</button>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 text-sm truncate">{item.name}</h4>
                      <p className="text-xs font-medium text-gray-500 mt-0.5">{formatPrice(item.price)} c/u</p>
                      <textarea
                        value={item.note || ""}
                        onChange={(e) => onUpdateNote(item.id, e.target.value)}
                        placeholder="Instrucciones especiales (opcional)"
                        className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all resize-none"
                        rows={1}
                      />
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <span className="font-black text-gray-900">{formatPrice(Number(item.price) * item.quantity)}</span>
                      <div className="flex items-center gap-2 bg-gray-50 rounded-xl border border-gray-200 p-1">
                        <button
                          onClick={() => onUpdateQty(item.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm hover:text-orange-500 transition-colors disabled:opacity-50"
                        >
                          {item.quantity <= 1 ? <Trash2 className="h-3.5 w-3.5 text-red-400" /> : <Minus className="h-3.5 w-3.5" />}
                        </button>
                        <span className="w-4 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm hover:text-green-500 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="px-6 py-5 bg-white border-t border-gray-100 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500 font-medium">Total a pagar</span>
              <span className="text-2xl font-black text-gray-900">{formatPrice(cartTotal)}</span>
            </div>
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="relative w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-200 hover:shadow-orange-300 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 overflow-hidden"
            >
              {submitting ? (
                <><Loader className="h-5 w-5 animate-spin" /> Procesando...</>
              ) : (
                <><Send className="h-5 w-5" /> Enviar pedido a cocina</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
