"use client"

import { Package } from "lucide-react"

export default function OrderItems({ items }) {
  if (!items || items.length === 0) return null

  return (
    <div className="px-4 pt-6">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
        <Package className="h-3.5 w-3.5" />Productos
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  <span className="font-bold text-amber-600">{item.quantity}x</span>{" "}
                  {item.product_name || item.name}
                </p>
                {(item.observations || item.notes) && (
                  <p className="mt-0.5 text-xs italic text-gray-400">&ldquo;{item.observations || item.notes}&rdquo;</p>
                )}
              </div>
              <p className="shrink-0 text-sm font-medium text-gray-900">
                ${(Number(item.unit_price) * item.quantity).toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
