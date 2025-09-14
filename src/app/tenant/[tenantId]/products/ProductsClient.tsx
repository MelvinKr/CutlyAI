"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { createClientBrowser } from "@/lib/supabase-client"

type Product = {
  id: string
  tenant_id: string
  name: string
  sku: string
  category: string | null
  retail_price: number
  is_active: boolean
  notes: string | null
  min_stock_threshold?: number
  stock_total?: number
  expiring_count?: number
}

type Props = {
  tenantId: string
  initialProducts: Product[]
  createAction: (formData: FormData) => Promise<{ ok?: boolean; error?: string }>
  updateAction: (formData: FormData) => Promise<{ ok?: boolean; error?: string }>
  archiveAction: (formData: FormData) => Promise<{ ok?: boolean; error?: string }>
}

const categories = ["shampoings", "colorations", "soins", "accessoires"] as const

export default function ProductsClient({
  tenantId,
  initialProducts,
  createAction,
  updateAction,
  archiveAction,
}: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [onlyUnder, setOnlyUnder] = useState(false)
  const [onlyExp, setOnlyExp] = useState(false)
  const [isPending, startTransition] = useTransition()
  const supabase = useMemo(() => createClientBrowser(), [])

  useEffect(() => {
    // Realtime subscription for this tenant
    const channel = supabase.channel(`products-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products", filter: `tenant_id=eq.${tenantId}` },
        (payload: any) => {
          setProducts((curr) => {
            const row = payload.new ?? payload.old
            if (!row) return curr
            if (payload.eventType === "DELETE") {
              return curr.filter((p) => p.id !== row.id)
            }
            const idx = curr.findIndex((p) => p.id === row.id)
            if (idx === -1) return [row, ...curr]
            const next = curr.slice()
            next[idx] = { ...next[idx], ...row }
            return next
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, tenantId])

  const filtered = products
    .filter(p => !onlyUnder || ((p.stock_total ?? 0) < (p.min_stock_threshold ?? -Infinity)))
    .filter(p => !onlyExp || ((p.expiring_count ?? 0) > 0))
    .sort((a, b) => {
      const aUnder = (a.stock_total ?? 0) < (a.min_stock_threshold ?? -Infinity)
      const bUnder = (b.stock_total ?? 0) < (b.min_stock_threshold ?? -Infinity)
      if (aUnder !== bUnder) return aUnder ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Produits</h1>
      <div className="flex gap-3 items-center text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={onlyUnder} onChange={e => setOnlyUnder(e.target.checked)} /> Afficher uniquement sous seuil</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={onlyExp} onChange={e => setOnlyExp(e.target.checked)} /> Lots expirant ≤ 30j</label>
      </div>
      <CreateForm tenantId={tenantId} action={createAction} isPending={isPending} startTransition={startTransition} />
      <div className="divide-y border rounded">
        {filtered.map((p) => (
          <EditRow key={p.id} product={p} tenantId={tenantId} updateAction={updateAction} archiveAction={archiveAction} isPending={isPending} startTransition={startTransition} />
        ))}
        {filtered.length === 0 && (
          <div className="p-4 text-sm text-gray-500">Aucun produit</div>
        )}
      </div>
    </div>
  )
}

function CreateForm({ tenantId, action, isPending, startTransition }: { tenantId: string; action: Props["createAction"]; isPending: boolean; startTransition: React.TransitionStartFunction }) {
  const [msg, setMsg] = useState<string | null>(null)
  const [skuError, setSkuError] = useState<string | null>(null)
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setMsg(null)
        setSkuError(null)
        const fd = new FormData(e.currentTarget as HTMLFormElement)
        await startTransition(async () => {
          const res = await action(fd)
          if ((res as any)?.error) {
            if (String((res as any).error).toLowerCase().includes('sku')) setSkuError(String((res as any).error))
          } else {
            ;(e.currentTarget as HTMLFormElement).reset()
            setMsg('Produit créé ✅')
            setTimeout(() => setMsg(null), 3000)
          }
        })
      }}
      className="grid gap-2 grid-cols-1 md:grid-cols-6 items-end border rounded p-3"
    >
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="md:col-span-2">
        <label className="block text-sm">Nom</label>
        <input name="name" required className="w-full border rounded p-2" placeholder="Shampoing réparateur" />
      </div>
      <div>
        <label className="block text-sm">SKU</label>
        <input name="sku" required className="w-full border rounded p-2" placeholder="SKU-001" />
        {skuError && <div className="text-xs text-red-700 mt-1">{skuError}</div>}
      </div>
      <div>
        <label className="block text-sm">Catégorie</label>
        <select name="category" className="w-full border rounded p-2">
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm">Prix TTC</label>
        <input name="retail_price" type="number" step="0.01" defaultValue={0} className="w-full border rounded p-2" />
      </div>
      <div className="md:col-span-1">
        <button disabled={isPending} className="w-full bg-black text-white rounded p-2">Créer</button>
      </div>
      {msg && <div className="md:col-span-6 text-xs text-emerald-700">{msg}</div>}
    </form>
  )
}

function EditRow({ product, tenantId, updateAction, archiveAction, isPending, startTransition }: {
  product: Product
  tenantId: string
  updateAction: Props["updateAction"]
  archiveAction: Props["archiveAction"]
  isPending: boolean
  startTransition: React.TransitionStartFunction
}) {
  return (
    <div className="p-3 grid gap-2 grid-cols-1 md:grid-cols-8 items-end">
      <form action={(fd) => startTransition(() => updateAction(fd))} className="contents">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="id" value={product.id} />
        <div className="md:col-span-2">
          <input name="name" defaultValue={product.name} className="w-full border rounded p-2" />
        </div>
        <div>
          <input name="sku" defaultValue={product.sku} className="w-full border rounded p-2" />
        </div>
        <div>
          <select name="category" defaultValue={product.category ?? "shampoings"} className="w-full border rounded p-2">
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <input name="retail_price" type="number" step="0.01" defaultValue={product.retail_price ?? 0} className="w-full border rounded p-2" />
        </div>
        <div>
          <div className="text-sm">Stock total</div>
          <div className="font-medium">{product.stock_total ?? 0}</div>
        </div>
        <div>
          <select name="is_active" defaultValue={product.is_active ? "true" : "false"} className="w-full border rounded p-2">
            <option value="true">Actif</option>
            <option value="false">Archivé</option>
          </select>
        </div>
        <div>
          {(product.stock_total ?? 0) < (product.min_stock_threshold ?? -Infinity) && (
            <span className="inline-block text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Sous seuil</span>
          )}
          {(product.expiring_count ?? 0) > 0 && (
            <span className="inline-block text-xs ml-2 bg-amber-100 text-amber-700 px-2 py-1 rounded">{product.expiring_count} lot(s) à exp</span>
          )}
        </div>
        <div className="md:col-span-1">
          <button disabled={isPending} className="w-full bg-blue-600 text-white rounded p-2">Enregistrer</button>
        </div>
      </form>
      <form action={(fd) => startTransition(() => archiveAction(fd))} className="md:col-span-1">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="id" value={product.id} />
        <button disabled={isPending} className="w-full bg-gray-700 text-white rounded p-2">Archiver</button>
      </form>
      <a href={`/tenant/${tenantId}/products/${product.id}/batches?returnTo=${encodeURIComponent(`/tenant/${tenantId}/products`)}`} className="md:col-span-1 text-blue-600 hover:underline text-sm">Lots</a>
    </div>
  )
}
