"use client"

import { useState } from "react"
import Papa from "papaparse"

type Row = Record<string, string>

type ImportReport = { created: number; updated: number; errors: { index: number; sku: string; message: string }[] }

export default function ImportCsvClient(
  { tenantId, importAction }: {
    tenantId: string,
    importAction: (fd: FormData) => Promise<ImportReport | { ok?: boolean; error?: string; details?: any }>
  }
) {
  const [rows, setRows] = useState<Row[]>([])
  const [preview, setPreview] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const onFile = (file: File) => {
    setError(null)
    setReport(null)
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setRows(res.data)
        setPreview(res.data.slice(0, 10))
      },
      error: (err) => setError(err.message),
    })
  }

  const onValidate = async () => {
    setIsImporting(true)
    setReport(null)
    try {
      const fd = new FormData()
      fd.append("tenantId", tenantId)
      fd.append("rows", JSON.stringify(rows))
      const res = await importAction(fd)
      if ((res as any)?.error) {
        setError((res as any).error)
      } else {
        setReport(res as ImportReport)
      }
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="border rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Importer CSV</div>
          <div className="text-xs text-gray-600">Colonnes: sku,name,brand,category,unit,unit_size,retail_price,cost_price,min_stock_threshold</div>
        </div>
        <input type="file" accept=".csv" onChange={(e) => e.target.files && onFile(e.target.files[0])} />
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {preview.length > 0 && (
        <div className="text-sm">
          <div className="font-medium mb-1">Aperçu (10 premières lignes)</div>
          <div className="overflow-auto max-h-64 border rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {['sku','name','brand','category','unit','unit_size','retail_price','cost_price','min_stock_threshold'].map(h => (
                    <th key={h} className="text-left px-2 py-1 border-b">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, idx) => (
                  <tr key={idx} className="odd:bg-white even:bg-gray-50">
                    {['sku','name','brand','category','unit','unit_size','retail_price','cost_price','min_stock_threshold'].map(h => (
                      <td key={h} className="px-2 py-1 border-b">{(r as any)[h] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button disabled={isImporting} onClick={onValidate} className="mt-2 bg-emerald-600 text-white rounded px-4 py-2 disabled:opacity-50">{isImporting ? 'Import en cours…' : 'Importer'}</button>
        </div>
      )}
      {report && (
        <div className="text-sm">
          <div className="font-medium mb-1">Rapport d'import</div>
          <div className="mb-2">Créés: <span className="font-medium">{report.created}</span> · Mis à jour: <span className="font-medium">{report.updated}</span></div>
          {report.errors.length > 0 && (
            <div>
              <div className="text-red-700 font-medium mb-1">Erreurs ({report.errors.length})</div>
              <div className="overflow-auto max-h-64 border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50"><tr><th className="px-2 py-1 border-b">Ligne</th><th className="px-2 py-1 border-b">SKU</th><th className="px-2 py-1 border-b">Message</th></tr></thead>
                  <tbody>
                    {report.errors.map((e, i) => (
                      <tr key={i} className="odd:bg-white even:bg-gray-50">
                        <td className="px-2 py-1 border-b">{e.index + 1}</td>
                        <td className="px-2 py-1 border-b">{e.sku}</td>
                        <td className="px-2 py-1 border-b">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
