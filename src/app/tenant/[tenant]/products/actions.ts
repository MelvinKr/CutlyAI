"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getSupabaseFromCookies } from "@/lib/supabase/server"

const schema = z.object({
  sku: z.string().trim().min(2),
  name: z.string().trim().min(2),
  brand: z.string().trim().optional().nullable(),
  category: z.string().trim().min(2),
  unit: z.string().trim().default('unit'),
  unit_size: z.coerce.number().optional().nullable().default(1),
  retail_price: z.coerce.number().min(0).default(0),
  cost_price: z.coerce.number().min(0).default(0),
  min_stock_thresh: z.coerce.number().int().min(0).default(0),
  tax_rate: z.coerce.number().min(0).max(0.3).default(0),
  is_active: z.coerce.boolean().default(true),
  expires_in_days: z.coerce.number().int().min(0).nullable().optional(),
})

type SearchParams = { q?: string; cat?: string; under?: boolean; exp30?: boolean; page?: number; pageSize?: number }

export async function searchProductsAction(tenant: string, params: SearchParams) {
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

  // Compute stock_total and expiring within 30 days (from product_batches) then apply in-memory filters
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

export async function createProductAction(tenant: string, formData: FormData) {
  const supabase = await getSupabaseFromCookies()
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map(i => i.message).join(', ') }
  const v = parsed.data
  const payload: any = {
    tenant_id: tenant,
    sku: v.sku.trim().toUpperCase(),
    name: v.name.trim(),
    brand: v.brand ?? null,
    category: v.category.trim(),
    unit: v.unit || 'unit',
    unit_size: v.unit_size ?? 1,
    retail_price: v.retail_price ?? 0,
    cost_price: v.cost_price ?? 0,
    min_stock_threshold: v.min_stock_thresh ?? 0,
    tax_rate: v.tax_rate ?? 0,
    is_active: v.is_active ?? true,
    expires_in_days: v.expires_in_days ?? null,
  }
  // Unique per tenant
  const { data: exists, error: exErr } = await supabase
    .from('products').select('id').eq('tenant_id', tenant).eq('sku', payload.sku).limit(1)
  if (exErr) return { ok: false, message: exErr.message }
  if (exists && exists.length) return { ok: false, message: 'SKU déjà utilisé pour ce tenant' }

  const { error } = await supabase.from('products').insert(payload)
  if (error) return { ok: false, message: error.message }
  revalidatePath(`/tenant/${tenant}/products`)
  return { ok: true }
}

export async function updateProductAction(tenant: string, id: string, formData: FormData) {
  const supabase = await getSupabaseFromCookies()
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map(i => i.message).join(', ') }
  const v = parsed.data
  const payload: any = {
    sku: v.sku.trim().toUpperCase(),
    name: v.name.trim(),
    brand: v.brand ?? null,
    category: v.category.trim(),
    unit: v.unit || 'unit',
    unit_size: v.unit_size ?? 1,
    retail_price: v.retail_price ?? 0,
    cost_price: v.cost_price ?? 0,
    min_stock_threshold: v.min_stock_thresh ?? 0,
    tax_rate: v.tax_rate ?? 0,
    is_active: v.is_active ?? true,
    expires_in_days: v.expires_in_days ?? null,
  }
  // Uniqueness per tenant excluding current id
  const { data: exists, error: exErr } = await supabase
    .from('products').select('id').eq('tenant_id', tenant).eq('sku', payload.sku).neq('id', id).limit(1)
  if (exErr) return { ok: false, message: exErr.message }
  if (exists && exists.length) return { ok: false, message: 'SKU déjà utilisé pour ce tenant' }

  const { error } = await supabase
    .from('products')
    .update(payload)
    .eq('tenant_id', tenant)
    .eq('id', id)
  if (error) return { ok: false, message: error.message }
  revalidatePath(`/tenant/${tenant}/products`)
  return { ok: true }
}

export async function deleteProductAction(tenant: string, id: string) {
  const supabase = await getSupabaseFromCookies()
  const { error } = await supabase.from('products').delete().eq('tenant_id', tenant).eq('id', id)
  if (error) return { ok: false, message: error.message }
  revalidatePath(`/tenant/${tenant}/products`)
  return { ok: true }
}

