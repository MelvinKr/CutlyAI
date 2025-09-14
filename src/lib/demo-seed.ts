import { createSupabaseServer } from "@/lib/supabase-server"

export async function ensureDemoSeed(tenantId: string) {
  if (tenantId !== 'demo') return
  const supabase = await createSupabaseServer()
  // Check any product exists for demo
  const { data: anyProd } = await supabase.from('products').select('id').eq('tenant_id', tenantId).limit(1)
  if (anyProd && anyProd.length > 0) return
  // Seed minimal data (best-effort; ignore RLS failures)
  try {
    const now = new Date().toISOString()
    const products = [
      { tenant_id: tenantId, sku: 'SKU-DEM-1', name: 'Shampoing Doux', brand: 'CoiffIA', category: 'shampoings', unit: 'u', retail_price: 9.9, cost_price: 4.0, min_stock_threshold: 5, is_active: true },
      { tenant_id: tenantId, sku: 'SKU-DEM-2', name: 'Coloration Intense', brand: 'CoiffIA', category: 'colorations', unit: 'u', retail_price: 19.9, cost_price: 9.0, min_stock_threshold: 3, is_active: true },
      { tenant_id: tenantId, sku: 'SKU-DEM-3', name: 'Soin Réparateur', brand: 'CoiffIA', category: 'soins', unit: 'u', retail_price: 14.9, cost_price: 6.0, min_stock_threshold: 10, is_active: true },
    ]
    const { data: created, error } = await supabase.from('products').insert(products).select('id,sku')
    if (error) return
    const p1 = created?.find(x => x.sku === 'SKU-DEM-1')?.id
    const p2 = created?.find(x => x.sku === 'SKU-DEM-2')?.id
    if (p1) {
      await supabase.from('product_batches').insert([
        { tenant_id: tenantId, product_id: p1, batch_code: 'BATCH-A', qty_on_hand: 2, received_at: now, exp_date: null, cost_price: 4 },
        { tenant_id: tenantId, product_id: p1, batch_code: 'BATCH-B', qty_on_hand: 1, received_at: now, exp_date: null, cost_price: 4 },
      ])
    }
    if (p2) {
      await supabase.from('product_batches').insert([
        { tenant_id: tenantId, product_id: p2, batch_code: 'BATCH-C', qty_on_hand: 5, received_at: now, exp_date: null, cost_price: 9 },
      ])
    }
  } catch {}
}

