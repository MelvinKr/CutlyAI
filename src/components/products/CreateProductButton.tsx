"use client"

import { useState, useTransition } from "react"
import ProductForm from "./ProductForm"

export default function CreateProductButton({ tenantId, createAction }: { tenantId: string; createAction: (fd: FormData) => Promise<any> }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <button aria-label="Ajouter un produit" onClick={() => setOpen(true)} className="bg-blue-600 text-white rounded px-3 py-2">Ajouter un produit</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-6 overflow-auto">
          <div role="dialog" aria-modal="true" className="bg-white text-gray-900 rounded w-full max-w-3xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="font-medium">Nouveau produit</div>
              <button onClick={() => setOpen(false)} className="text-sm">Fermer</button>
            </div>
            <div className="p-4">
              {error && <div className="text-sm text-red-700 mb-2" role="alert">{error}</div>}
              <ProductForm
                mode="create"
                onSubmit={(fd) => createAction(fd)}
                onSuccess={() => { setOpen(false); setError(null) }}
                onError={(m) => setError(m)}
                onCancel={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

