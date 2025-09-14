import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getSupabaseFromCookies } from "@/lib/supabase/server"

// Keep schema export at module level (no 'use server' at top)
export const productSchema = z.object({
  sku: z.string().trim().min(2, "SKU trop court").transform((s) => s.toUpperCase()),
  name: z.string().trim().min(2, "Nom trop court"),
  brand: z.string().trim().optional().nullable().default(null),
  category: z.string().trim().min(2, "Catégorie requise"),
  unit: z.string().trim().default("unit"),
  unit_size: z.coerce.number().optional().nullable(),
  retail_price: z.coerce.number().min(0).default(0),
  cost_price: z.coerce.number().min(0).default(0),
  min_stock_thresh: z.coerce.number().int().min(0).default(0),
  tax_rate: z.coerce.number().min(0).max(0.3).default(0),
  is_active: z.coerce.boolean().default(true),
  expires_in_days: z.coerce.number().int().min(0).nullable().optional(),
})

type ProductInput = z.infer<typeof productSchema>

function mapToDbFields(tenant: string, v: ProductInput) {
  const base: Record<string, any> = {
    tenant_id: tenant,
    sku: v.sku,
    name: v.name,
    brand: v.brand ?? null,
    category: v.category,
    unit: v.unit || "unit",
    unit_size: v.unit_size ?? 1,
    retail_price: v.retail_price ?? 0,
    cost_price: v.cost_price ?? 0,
    min_stock_threshold: v.min_stock_thresh ?? 0,
    tax_rate: v.tax_rate ?? 0,
    is_active: v.is_active ?? true,
    expires_in_days: v.expires_in_days ?? null,
  }
  return base
}

export async function createProductAction(tenant: string, formData: FormData) {
  'use server'
  const supabase = await getSupabaseFromCookies()
  const parsed = productSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map(i => i.message).join(', ') }
  const v = parsed.data
  const payload = mapToDbFields(tenant, v)

  // Unique per tenant
  const { data: ex, error: exErr } = await supabase.from('products').select('id').eq('tenant_id', tenant).eq('sku', payload.sku).limit(1)
  if (exErr) return { ok: false, message: exErr.message }
  if (ex && ex.length) return { ok: false, message: 'SKU déjà utilisé pour ce tenant' }

  const { error } = await supabase.from('products').insert(payload)
  if (error) return { ok: false, message: error.message }
  revalidatePath(`/tenant/${tenant}/products`)
  return { ok: true }
}

export async function updateProductAction(id: string, tenant: string, formData: FormData) {
  'use server'
  const supabase = await getSupabaseFromCookies()
  const parsed = productSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map(i => i.message).join(', ') }
  const v = parsed.data
  const payload = mapToDbFields(tenant, v)

  const { data: ex, error: exErr } = await supabase
    .from('products').select('id').eq('tenant_id', tenant).eq('sku', payload.sku).neq('id', id).limit(1)
  if (exErr) return { ok: false, message: exErr.message }
  if (ex && ex.length) return { ok: false, message: 'SKU déjà utilisé pour ce tenant' }

  const { error } = await supabase.from('products').update(payload).eq('tenant_id', tenant).eq('id', id)
  if (error) return { ok: false, message: error.message }
  revalidatePath(`/tenant/${tenant}/products`)
  return { ok: true }
}

export async function deleteProductAction(id: string, tenant: string) {
  'use server'
  const supabase = await getSupabaseFromCookies()
  const { error } = await supabase.from('products').delete().eq('tenant_id', tenant).eq('id', id)
  if (error) return { ok: false, message: error.message }
  revalidatePath(`/tenant/${tenant}/products`)
  return { ok: true }
}

export async function searchProductsAction(tenant: string, params: { q?: string; cat?: string; under?: boolean; exp30?: boolean; page?: number; pageSize?: number }) {
  'use server'
  const supabase = await getSupabaseFromCookies()
  const page = Math.max(1, params.page || 1)
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let q = supabase
    .from('products')
    .select('id, tenant_id, sku, name, brand, category, unit, unit_size, retail_price, cost_price, min_stock_threshold, is_active, updated_at', { count: 'exact' })
    .eq('tenant_id', tenant)

  if (params.q && params.q.trim()) {
    const like = `%${params.q.trim()}%`
    q = q.or(`sku.ilike.${like},name.ilike.${like},brand.ilike.${like},category.ilike.${like}`)
  }
  if (params.cat && params.cat.trim()) q = q.eq('category', params.cat.trim())

  q = q.order('updated_at', { ascending: false })
  const { data, count } = await q.range(from, to)

  // Compute stock/expiry projections from product_batches
  const ids = (data || []).map((p: any) => p.id)
  const totals: Record<string, number> = {}
  const expiring: Record<string, number> = {}
  if (ids.length) {
    const in30 = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
    const { data: batches } = await supabase
      .from('product_batches')
      .select('product_id, qty_on_hand, exp_date')
      .in('product_id', ids)
    for (const b of batches || []) {
      totals[b.product_id] = (totals[b.product_id] || 0) + (b.qty_on_hand || 0)
      if (b.exp_date && b.exp_date <= in30) expiring[b.product_id] = (expiring[b.product_id] || 0) + 1
    }
  }

  let rows = (data || []).map((p: any) => ({
    ...p,
    stock_total: totals[p.id] || 0,
    expiring_count: expiring[p.id] || 0,
  }))

  if (params.under) rows = rows.filter(r => (r.min_stock_threshold || 0) > 0 && (r.stock_total || 0) <= (r.min_stock_threshold || 0))
  if (params.exp30) rows = rows.filter(r => (r.expiring_count || 0) > 0)

  return { rows, total: count || 0, page, pageSize }
}
