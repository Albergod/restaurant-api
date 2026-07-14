"use client"

import { Tag, Plus } from "lucide-react"

function formatPrice(price) {
  return `$${Number(price).toFixed(2)}`
}

export default function PromotionsCarousel({ promotions, onAdd }) {
  if (!promotions || promotions.length === 0) return null

  return (
    <section className="px-4 pt-5">
      <div className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-4 shadow-lg shadow-orange-200/50 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-20">
          <Tag className="h-24 w-24 transform rotate-12" />
        </div>
        <div className="relative z-10">
          <div className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-50">
            <Tag className="h-4 w-4" />
            Promociones
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x hide-scrollbar">
            {promotions.map((p) => (
              <div
                key={p.id}
                className="snap-start flex shrink-0 flex-col justify-between rounded-xl bg-white/20 backdrop-blur-md p-3 border border-white/30 text-white min-w-[160px]"
              >
                <div>
                  <p className="font-bold text-sm truncate">{p.name}</p>
                  <p className="text-xs text-amber-100 line-through mt-1">{formatPrice(p.price)}</p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-black text-lg">{formatPrice(p.promo_price)}</span>
                  <button onClick={() => onAdd(p)} className="bg-white text-orange-600 p-1.5 rounded-lg hover:bg-orange-50 transition-colors">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
