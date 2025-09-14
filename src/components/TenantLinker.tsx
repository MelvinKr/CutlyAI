"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export default function TenantLinker() {
  const router = useRouter()
  const [tenantId, setTenantId] = useState("")

  return (
    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
      <div>
        <label className="block text-sm mb-1">Tenant ID</label>
        <input
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          placeholder="ex: demo"
          className="border rounded px-3 py-2 w-64"
        />
      </div>
      <button
        onClick={() => tenantId && router.push(`/tenant/${tenantId}/products`)}
        className="bg-black text-white rounded px-4 py-2"
      >
        Ouvrir Produits
      </button>
    </div>
  )
}

