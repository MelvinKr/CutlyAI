"use server"

import { revalidatePath } from "next/cache"
import { createSupabaseServer } from "@/lib/supabase-server"
import { withTelemetry } from "@/lib/telemetry"
import { z } from "zod"

type Category = "shampoings" | "colorations" | "soins" | "accessoires"

const getSupabase = async () => await createSupabaseServer()

export async function createProduct(formData: FormData) {
  const supabase = await getSupabase()
  const tenantId = String(formData.get("tenantId") || "").trim()
  const name = String(formData.get("name") || "").trim()
  const sku = String(formData.get("sku") || "").trim()
  const category = String(formData.get("category") || "").trim() as Category
  const retailPrice = Number(formData.get("retail_price") || 0)
  const notes = (formData.get("notes") as string) || null

  if (!tenantId) return { error: "tenantId manquant" }
  if (!name) return { error: "Nom obligatoire" }
  if (!sku) return { error: "SKU obligatoire" }

  // Enforce SKU unique per tenant (app-level guard)
  const { data: existing, error: existErr } = await supabase
    .from("products")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("sku", sku)
    .limit(1)

  if (existErr) return { error: existErr.message }
  if (existing && existing.length > 0)
    return { error: "SKU déjà utilisé pour ce tenant" }

  const { error } = await supabase.from("products").insert({
    tenant_id: tenantId,
    name,
    sku,
    category,
    retail_price: isNaN(retailPrice) ? 0 : retailPrice,
    is_active: true,
  })

  if (error) return { error: error.message }
  revalidatePath(`/tenant/${tenantId}/products`)
  return { ok: true }
}

export async function updateProduct(formData: FormData) {
  const supabase = await getSupabase()
  const tenantId = String(formData.get("tenantId") || "").trim()
  const id = String(formData.get("id") || "").trim()
  const name = String(formData.get("name") || "").trim()
  const sku = String(formData.get("sku") || "").trim()
  const category = String(formData.get("category") || "").trim() as Category
  const retailPrice = Number(formData.get("retail_price") || 0)
  const isActive = String(formData.get("is_active") || "true") === "true"
  const notes = (formData.get("notes") as string) || null

  if (!tenantId || !id) return { error: "Identifiants manquants" }
  if (!name) return { error: "Nom obligatoire" }
  if (!sku) return { error: "SKU obligatoire" }

  // Ensure SKU unique per tenant excluding current product
  const { data: existing, error: existErr } = await supabase
    .from("products")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("sku", sku)
    .neq("id", id)
    .limit(1)

  if (existErr) return { error: existErr.message }
  if (existing && existing.length > 0)
    return { error: "SKU déjà utilisé pour ce tenant" }

  const { error } = await supabase
    .from("products")
    .update({
      name,
      sku,
      category,
      retail_price: isNaN(retailPrice) ? 0 : retailPrice,
      is_active: isActive,
      notes,
    })
    .eq("id", id)
    .eq("tenant_id", tenantId)

  if (error) return { error: error.message }
  revalidatePath(`/tenant/${tenantId}/products`)
  return { ok: true }
}

export async function archiveProduct(formData: FormData) {
  const supabase = await getSupabase()
  const tenantId = String(formData.get("tenantId") || "").trim()
  const id = String(formData.get("id") || "").trim()
  if (!tenantId || !id) return { error: "Identifiants manquants" }

  const { error } = await supabase
    .from("products")
    .update({ is_active: false })
    .eq("id", id)
    .eq("tenant_id", tenantId)

  if (error) return { error: error.message }
  revalidatePath(`/tenant/${tenantId}/products`)
  return { ok: true }
}

export async function importProductsCsv(formData: FormData) {
  const supabase = await getSupabase()
  const tenantId = String(formData.get("tenantId") || "").trim()
  const rowsStr = String(formData.get("rows") || "[]")
  if (!tenantId) return { error: "tenantId manquant" }
  let rows: any[] = []
  try { rows = JSON.parse(rowsStr) } catch { return { error: "CSV invalide" } }

  return withTelemetry("importProductsCsv", tenantId, async () => {
    const schema = z.object({
      sku: z.string().trim().min(1, "SKU requis"),
      name: z.string().trim().min(1, "Nom requis"),
      brand: z.string().trim().optional().nullable(),
      category: z.string().trim().optional().nullable(),
      unit: z.string().trim().default("u"),
      unit_size: z.coerce.number().optional().nullable(),
      retail_price: z.coerce.number().default(0),
      cost_price: z.coerce.number().default(0),
      min_stock_threshold: z.coerce.number().default(0),
    })

    // Validate rows and collect errors per line
    const validRows: any[] = []
    const errors: { index: number; sku: string; message: string }[] = []
    rows.forEach((r, idx) => {
      const parsed = schema.safeParse(r)
      if (!parsed.success) {
        errors.push({ index: idx, sku: String(r?.sku ?? ''), message: parsed.error.issues.map(i => i.message).join(', ') })
        return
      }
      const v = parsed.data
      validRows.push({
        tenant_id: tenantId,
        sku: v.sku,
        name: v.name,
        brand: v.brand ?? null,
        category: v.category ?? null,
        unit: v.unit || 'u',
        unit_size: v.unit_size ?? null,
        retail_price: v.retail_price ?? 0,
        cost_price: v.cost_price ?? 0,
        min_stock_threshold: v.min_stock_threshold ?? 0,
        is_active: true,
      })
    })

    if (validRows.length === 0) {
      return { created: 0, updated: 0, errors }
    }

    // Determine existing SKUs for this tenant
    const skus = Array.from(new Set(validRows.map(r => r.sku)))
    const { data: existing } = await supabase
      .from('products')
      .select('sku')
      .eq('tenant_id', tenantId)
      .in('sku', skus)
    const existingSet = new Set((existing || []).map(r => r.sku))
    const toInsert = validRows.filter(r => !existingSet.has(r.sku))
    const toUpdate = validRows.filter(r => existingSet.has(r.sku))

    const chunk = 50
    let created = 0
    let updated = 0
    // Inserts
    for (let i = 0; i < toInsert.length; i += chunk) {
      const part = toInsert.slice(i, i + chunk)
      const { error } = await supabase.from('products').insert(part)
      if (error) {
        part.forEach((r, idx) => errors.push({ index: idx, sku: r.sku, message: error.message }))
      } else {
        created += part.length
      }
    }
    // Updates (by sku)
    for (let i = 0; i < toUpdate.length; i += chunk) {
      const part = toUpdate.slice(i, i + chunk)
      for (const r of part) {
        const { error } = await supabase
          .from('products')
          .update({
            name: r.name,
            brand: r.brand,
            category: r.category,
            unit: r.unit,
            unit_size: r.unit_size,
            retail_price: r.retail_price,
            cost_price: r.cost_price,
            min_stock_threshold: r.min_stock_threshold,
            is_active: r.is_active,
          })
          .eq('tenant_id', tenantId)
          .eq('sku', r.sku)
        if (error) {
          errors.push({ index: 0, sku: r.sku, message: error.message })
        } else {
          updated += 1
        }
      }
    }

    revalidatePath(`/tenant/${tenantId}/products`)
    return { created, updated, errors }
  })
}
