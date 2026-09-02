"use client"

import { Plus, Image } from "lucide-react"
import { getImageUrl } from "@/lib/api"

function formatPrice(price) {
  return `$${Number(price).toFixed(2)}`
}

export default function ProductCard({ product, onAdd, index }) {
  const hasPromo = product.promo_price && product.promo_price < product.price

  return (
    <div
      key={product.id}
      style={{ animationDelay: `${index * 50}ms` }}
      className="glass-card rounded-2xl overflow-hidden flex flex-col animate-slide-up"
    >
      <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img src={getImageUrl(product.image_url)} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <Image className="h-10 w-10 text-gray-300" />
        )}
      </div>
      <div className="flex flex-col flex-1 p-3 gap-1.5">
        <div className="flex items-start justify-between gap-1">
          <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2 flex-1">
            {product.name}
          </h3>
          {product.is_available === false && (
            <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[8px] uppercase font-black text-red-600">
              Agotado
            </span>
          )}
        </div>
        <p className="text-[10px] uppercase font-bold text-amber-500 truncate">
          {product.category_name}
        </p>
        {product.description && (
          <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div>
            <span className={`text-base font-black ${hasPromo ? "text-red-500" : "text-gray-900"}`}>
              {formatPrice(hasPromo ? product.promo_price : product.price)}
            </span>
            {hasPromo && (
              <span className="ml-1 text-[10px] font-bold text-gray-400 line-through">
                {formatPrice(product.price)}
              </span>
            )}
          </div>
          <button
            onClick={() => onAdd(product)}
            disabled={product.is_available === false}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white transition-all hover:bg-amber-600 hover:scale-110 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 shadow-sm shadow-amber-200"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
