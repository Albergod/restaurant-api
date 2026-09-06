"use client"

export default function DeleteDialog({ item, title = "Eliminar", description = "Esta acción no se puede deshacer.", onConfirm, onClose }) {
  if (!item) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-500">
          ¿Estás seguro de eliminar <strong>{item.name}</strong>? {description}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">Cancelar</button>
          <button onClick={() => onConfirm(item.id)}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600">Eliminar</button>
        </div>
      </div>
    </div>
  )
}
