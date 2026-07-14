"use client"

import { Flame, UtensilsCrossed, Plus } from "lucide-react"

function formatPrice(price) {
  return `$${Number(price).toFixed(2)}`
}

export default function FeaturedCarousel({ featured, onAdd }) {
  if (!featured || featured.length === 0) return null

  return (
    <section className="px-4 pt-6">
      <div className="mb-3 flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-orange-100 text-orange-500">
          <Flame className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">Destacados</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar px-1">
        {featured.map((p, index) => (
          <div
            key={p.id}
            style={{ animationDelay: `${index * 50}ms` }}
            className="snap-start shrink-0 glass-card rounded-2xl p-4 flex flex-col justify-between w-[160px] animate-slide-up"
          >
            <div>
              <div className="h-24 w-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl mb-3 flex items-center justify-center shadow-inner">
                <UtensilsCrossed className="h-8 w-8 text-gray-300" />
              </div>
              <p className="font-bold text-gray-900 text-sm line-clamp-2 leading-tight">{p.name}</p>
              <p className="mt-1 text-[10px] uppercase font-bold text-amber-500">{p.category_name}</p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="font-black text-gray-900">{formatPrice(p.price)}</p>
              <button
                onClick={() => onAdd(p)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-900 text-white transition-all hover:bg-gray-800 hover:scale-110 active:scale-95 shadow-md"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
