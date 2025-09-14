"use client"

import { useState } from "react"
import Papa from "papaparse"

type Row = {
  sku: string
  name: string
  brand?: string
  category?: string
  unit?: string
  unit_size?: number
  retail_price?: number
  cost_price?: number
  min_stock_thresh?: number
  tax_rate?: number
}

type ImportReport = { created: number; updated: number; errors: Array<{ index: number; message: string }> }

export default function CsvImportDialog({ importAction }: { importAction: (rows: Row[]) => Promise<ImportReport> }) {
  const [rows, setRows] = useState<Row[]>([])
  const [preview, setPreview] = useState<Row[]>([])
  const [report, setReport] = useState<ImportReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const onFile = (file: File) => {
    setReport(null)
    setError(null)
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

  const onImport = async () => {
    setIsImporting(true)
    try {
      const r = await importAction(rows)
      setReport(r)
    } catch (e: any) {
      setError(e?.message || 'Import échoué')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="border rounded p-3 w-full md:w-auto">
      <div className="flex items-center gap-3">
        <div>
          <div className="font-medium">Importer CSV</div>
          <div className="text-xs text-gray-600">sku,name,brand,category,unit,unit_size,retail_price,cost_price,min_stock_thresh,tax_rate</div>
        </div>
        <input type="file" accept=".csv" onChange={(e) => e.target.files && onFile(e.target.files[0])} />
      </div>
      {preview.length > 0 && (
        <div className="mt-3 text-sm">
          <div className="font-medium mb-1">Aperçu (10 lignes)</div>
          <div className="overflow-auto max-h-64 border rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {['sku','name','brand','category','unit','unit_size','retail_price','cost_price','min_stock_thresh','tax_rate'].map(h => (
                    <th key={h} className="text-left px-2 py-1 border-b">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="odd:bg-white even:bg-gray-50">
                    {['sku','name','brand','category','unit','unit_size','retail_price','cost_price','min_stock_thresh','tax_rate'].map(h => (
                      <td key={h} className="px-2 py-1 border-b">{(r as any)[h] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button disabled={isImporting} onClick={onImport} className="mt-2 bg-emerald-600 text-white rounded px-4 py-2 disabled:opacity-50">
            {isImporting ? 'Import en cours…' : 'Importer'}
          </button>
        </div>
      )}
      {report && (
        <div className="mt-3 text-sm">
          <div className="mb-1">Créés: <span className="font-medium">{report.created}</span> · Mis à jour: <span className="font-medium">{report.updated}</span></div>
          {report.errors.length > 0 && (
            <div>
              <div className="text-red-700 font-medium mb-1">Erreurs ({report.errors.length})</div>
              <div className="overflow-auto max-h-64 border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50"><tr><th className="px-2 py-1 border-b">Ligne</th><th className="px-2 py-1 border-b">Message</th></tr></thead>
                  <tbody>
                    {report.errors.map((e, i) => (
                      <tr key={i} className="odd:bg-white even:bg-gray-50">
                        <td className="px-2 py-1 border-b">{e.index + 1}</td>
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
      {error && <div className="text-sm text-red-700 mt-2">{error}</div>}
    </div>
  )
}

