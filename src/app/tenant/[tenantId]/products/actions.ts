"use server"

import { revalidatePath } from "next/cache"
import { createSupabaseServer } from "@/lib/supabase-server"
import { withTelemetry } from "@/lib/telemetry"

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
    const normalized = rows.map(r => ({
      tenant_id: tenantId,
      sku: String(r.sku || "").trim(),
      name: String(r.name || "").trim(),
      brand: r.brand ?? null,
      category: r.category ?? null,
      unit: r.unit ?? "u",
      unit_size: r.unit_size ? Number(r.unit_size) : null,
      retail_price: r.retail_price ? Number(r.retail_price) : 0,
      cost_price: r.cost_price ? Number(r.cost_price) : 0,
      min_stock_threshold: r.min_stock_threshold ? Number(r.min_stock_threshold) : 0,
      is_active: true,
    })).filter(x => x.sku && x.name)

    const chunk = 100
    const errors: { index: number; sku: string; message: string }[] = []
    for (let i = 0; i < normalized.length; i += chunk) {
      const part = normalized.slice(i, i + chunk)
      const { error } = await supabase
        .from("products")
        .upsert(part, { onConflict: "tenant_id,sku" })
      if (error) {
        // Record generic error; detailed per-row errors need row-by-row processing
        errors.push({ index: i, sku: part[0]?.sku ?? "?", message: error.message })
      }
    }

    revalidatePath(`/tenant/${tenantId}/products`)
    if (errors.length) return { error: `Erreurs lors de l'upsert: ${errors.length}` , details: errors }
    return { ok: true }
  })
}
