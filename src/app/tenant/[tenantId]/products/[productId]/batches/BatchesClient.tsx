"use client"

import { useEffect, useMemo, useState } from "react"
import { createClientBrowser } from "@/lib/supabase-client"

type Batch = {
  id: string
  batch_code: string | null
  exp_date: string | null
  qty_on_hand: number
  received_at: string
  supplier_id: string | null
}

type Movement = {
  id: string
  created_at: string
  type: "IN" | "ADJUST"
  qty: number
  reason: string
  batch_id: string | null
}

export default function BatchesClient({ tenantId, productId, initialBatches, initialMovements }: {
  tenantId: string
  productId: string
  initialBatches: Batch[]
  initialMovements: Movement[]
}) {
  const [batches, setBatches] = useState<Batch[]>(initialBatches)
  const [movements, setMovements] = useState<Movement[]>(initialMovements)
  const supabase = useMemo(() => createClientBrowser(), [])

  useEffect(() => {
    const ch1 = supabase.channel(`product_batches-${tenantId}-${productId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_batches", filter: `tenant_id=eq.${tenantId}` }, (payload: any) => {
        setBatches((curr) => {
          const row = payload.new ?? payload.old
          if (!row) return curr
          if (row.product_id !== productId) return curr
          if (payload.eventType === "DELETE") return curr.filter(b => b.id !== row.id)
          const idx = curr.findIndex(b => b.id === row.id)
          if (idx === -1) return [row, ...curr]
          const next = curr.slice(); next[idx] = { ...next[idx], ...row }; return next
        })
      })
      .subscribe()

    const ch2 = supabase.channel(`stock_movements-${tenantId}-${productId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements", filter: `tenant_id=eq.${tenantId}` }, (payload: any) => {
        setMovements((curr) => {
          const row = payload.new ?? payload.old
          if (!row) return curr
          if (row.product_id !== productId) return curr
          if (payload.eventType === "DELETE") return curr.filter(m => m.id !== row.id)
          const idx = curr.findIndex(m => m.id === row.id)
          if (idx === -1) return [row, ...curr]
          const next = curr.slice(); next[idx] = { ...next[idx], ...row }; return next
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
    }
  }, [supabase, tenantId, productId])

  const soon = (d: string | null) => {
    if (!d) return false
    const exp = new Date(d).getTime()
    const in30 = Date.now() + 30 * 24 * 3600 * 1000
    return exp <= in30
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Lots & Réceptions</h1>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <form action={"/api/placeholder"} className="border rounded p-4">
          <h2 className="font-medium mb-3">Réception de stock (IN)</h2>
          <div className="grid gap-3 grid-cols-2">
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="productId" value={productId} />
            <div className="col-span-2">
              <label className="block text-sm">Code lot (optionnel)</label>
              <input name="batch_code" className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm">Date péremption</label>
              <input type="date" name="exp_date" className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm">Quantité (IN)</label>
              <input type="number" step="1" name="qty_in" required className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm">Fournisseur (id)</label>
              <input name="supplier_id" className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm">Coût unitaire</label>
              <input type="number" step="0.01" name="unit_cost" className="w-full border rounded p-2" />
            </div>
          </div>
          <button formAction={receiveStock as any} className="mt-3 bg-black text-white rounded px-4 py-2">Valider IN</button>
        </form>

        <form action={"/api/placeholder"} className="border rounded p-4">
          <h2 className="font-medium mb-3">Ajuster (ADJUST)</h2>
          <div className="grid gap-3 grid-cols-2">
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="productId" value={productId} />
            <div className="col-span-2">
              <label className="block text-sm">Batch ID</label>
              <input name="batch_id" required className="w-full border rounded p-2" placeholder="Sélectionner un lot ci-dessous" />
            </div>
            <div>
              <label className="block text-sm">Delta quantité</label>
              <input type="number" step="1" name="qty_delta" required className="w-full border rounded p-2" />
            </div>
            <div>
              <label className="block text-sm">Raison</label>
              <select name="reason" className="w-full border rounded p-2">
                <option value="correction">correction</option>
                <option value="perte">perte</option>
                <option value="inventaire">inventaire</option>
              </select>
            </div>
          </div>
          <button formAction={adjustStock as any} className="mt-3 bg-blue-600 text-white rounded px-4 py-2">Ajuster</button>
        </form>
      </div>

      <div className="border rounded">
        <div className="p-3 font-medium">Lots</div>
        <div className="divide-y">
          {batches.map(b => (
            <div key={b.id} className="p-3 grid grid-cols-6 gap-2 items-center text-sm">
              <div className="col-span-2">
                <div className="font-mono">{b.batch_code ?? '—'}</div>
                {b.exp_date && (
                  <div className={`text-xs ${soon(b.exp_date) ? 'text-red-600' : 'text-gray-500'}`}>exp: {new Date(b.exp_date).toLocaleDateString()}</div>
                )}
              </div>
              <div>Qté: <span className="font-medium">{b.qty_on_hand}</span></div>
              <div>Reçu: {new Date(b.received_at).toLocaleDateString()}</div>
              <div>Supplier: {b.supplier_id ?? '—'}</div>
              <div className="text-gray-500">id: {b.id}</div>
            </div>
          ))}
          {batches.length === 0 && <div className="p-3 text-sm text-gray-500">Aucun lot</div>}
        </div>
      </div>

      <div className="border rounded">
        <div className="p-3 font-medium">Mouvements</div>
        <div className="divide-y">
          {movements.map(m => (
            <div key={m.id} className="p-3 grid grid-cols-5 gap-2 text-sm">
              <div>{new Date(m.created_at).toLocaleString()}</div>
              <div className="font-medium">{m.type}</div>
              <div>Qté: {m.qty}</div>
              <div>{m.reason}</div>
              <div className="text-gray-500">batch: {m.batch_id ?? '—'}</div>
            </div>
          ))}
          {movements.length === 0 && <div className="p-3 text-sm text-gray-500">Aucun mouvement</div>}
        </div>
      </div>
    </div>
  )
}

// Import server actions with explicit type to use as formAction
import { receiveStock, adjustStock } from "./actions"

