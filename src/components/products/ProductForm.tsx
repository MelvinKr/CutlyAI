"use client"

import { useState, useTransition } from "react"

type Props = {
  mode: "create" | "edit"
  initial?: Partial<Record<string, any>>
  onSubmit: (formData: FormData) => Promise<any>
  onDelete?: () => Promise<any>
  onSuccess?: () => void
  onError?: (message: string) => void
  onCancel?: () => void
}

export default function ProductForm({ mode, initial, onSubmit, onDelete, onSuccess, onError, onCancel }: Props) {
  const [msg, setMsg] = useState<string | null>(null)
  const [skuError, setSkuError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setMsg(null)
        setSkuError(null)
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
          const res = await onSubmit(fd)
          if (res?.ok) {
            if (mode === 'create') (e.currentTarget as HTMLFormElement).reset()
            setMsg(mode === 'create' ? 'Produit créé ✅' : 'Produit mis à jour ✅')
            setTimeout(() => setMsg(null), 2000)
            onSuccess?.()
          } else if (res?.message || res?.error) {
            const m = String(res.message || res.error)
            if (m.toLowerCase().includes('sku')) setSkuError(m)
            onError?.(m)
          }
        })
      }}
      className="grid gap-2 grid-cols-1 md:grid-cols-3 border rounded p-4"
    >
      <div>
        <label className="block text-sm">Nom</label>
        <input name="name" defaultValue={String(initial?.name ?? '')} required className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="block text-sm">SKU</label>
        <input name="sku" defaultValue={String(initial?.sku ?? '')} required className="w-full border rounded p-2" />
        {skuError && <div className="text-xs text-red-700 mt-1">{skuError}</div>}
      </div>
      <div>
        <label className="block text-sm">Marque</label>
        <input name="brand" defaultValue={String(initial?.brand ?? '')} className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="block text-sm">Catégorie</label>
        <input name="category" defaultValue={String(initial?.category ?? '')} className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="block text-sm">Unité</label>
        <input name="unit" defaultValue={String(initial?.unit ?? 'unit')} className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="block text-sm">Taille</label>
        <input name="unit_size" type="number" step="0.01" defaultValue={Number(initial?.unit_size ?? 1)} className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="block text-sm">Prix TTC</label>
        <input name="retail_price" type="number" step="0.01" defaultValue={Number(initial?.retail_price ?? 0)} className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="block text-sm">Prix d'achat</label>
        <input name="cost_price" type="number" step="0.01" defaultValue={Number(initial?.cost_price ?? 0)} className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="block text-sm">Seuil min</label>
        <input name="min_stock_thresh" type="number" step="1" defaultValue={Number(initial?.min_stock_threshold ?? 0)} className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="block text-sm">Taxe</label>
        <input name="tax_rate" type="number" step="0.01" defaultValue={Number(initial?.tax_rate ?? 0)} className="w-full border rounded p-2" />
      </div>
      <div>
        <label className="block text-sm">Actif</label>
        <select name="is_active" defaultValue={(initial?.is_active ?? true) ? 'true' : 'false'} className="w-full border rounded p-2">
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
      </div>
      <div className="md:col-span-3 flex items-center gap-3 mt-2">
        <button disabled={isPending} className="bg-black text-white rounded px-4 py-2">{mode === 'create' ? 'Créer' : 'Enregistrer'}</button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="border rounded px-4 py-2">Annuler</button>
        )}
        {onDelete && (
          <button type="button" onClick={() => startTransition(onDelete)} className="bg-red-600 text-white rounded px-4 py-2">Supprimer</button>
        )}
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
      </div>
    </form>
  )
}
