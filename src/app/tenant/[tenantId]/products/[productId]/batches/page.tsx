import { createSupabaseServer } from "@/lib/supabase-server"
import BatchesClient from "./BatchesClient"

export default async function BatchesPage({ params, searchParams }: { params: { tenantId: string, productId: string }, searchParams: { returnTo?: string } }) {
  const { tenantId, productId } = params
  const supabase = await createSupabaseServer()

  const { data: batches } = await supabase
    .from("product_batches")
    .select("id, batch_code, exp_date, qty_on_hand, received_at, supplier_id, product_id")
    .eq("tenant_id", tenantId)
    .eq("product_id", productId)
    .order("received_at", { ascending: false })

  const { data: movements } = await supabase
    .from("stock_movements")
    .select("id, created_at, type, qty, reason, batch_id, product_id")
    .eq("tenant_id", tenantId)
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(100)

  const returnTo = searchParams?.returnTo

  return (
    <div className="p-6 space-y-4">
      {returnTo && (
        <a href={returnTo} className="text-sm text-blue-600 hover:underline">← Retour</a>
      )}
      <BatchesClient
        tenantId={tenantId}
        productId={productId}
        initialBatches={(batches || []).map(b => ({ id: b.id, batch_code: b.batch_code, exp_date: b.exp_date, qty_on_hand: b.qty_on_hand, received_at: b.received_at, supplier_id: b.supplier_id }))}
        initialMovements={(movements || []).map(m => ({ id: m.id, created_at: m.created_at, type: m.type as any, qty: m.qty, reason: m.reason, batch_id: m.batch_id }))}
      />
    </div>
  )
}

