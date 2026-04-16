"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import BackButton from "@/components/BackButton";
import PaginationControls from "@/components/PaginationControls";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/useToast";

const PAGE_SIZE = 10;

interface PreviewRow {
  rowNumber: number;
  data: {
    name: string;
    description: string;
    price: string;
    cost: string;
    sku: string;
    stock: string;
    status: string;
    category: string;
  };
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

interface PreviewResponse {
  preview: PreviewRow[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
  columns: string[];
}

interface ImportResults {
  results: {
    successful: Array<{
      rowNumber: number;
      productId: string;
      name: string;
    }>;
    failed: Array<{
      rowNumber: number;
      data: PreviewRow["data"];
      error: string;
    }>;
  };
  summary: {
    successful: number;
    failed: number;
    total: number;
  };
}

export default function ImportPage() {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [failedPage, setFailedPage] = useState(1);

  useEffect(() => {
    setPreviewPage(1);
  }, [preview?.summary.total]);

  useEffect(() => {
    setFailedPage(1);
  }, [importResults?.summary.failed]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
        toast.error("Please upload a CSV file");
        return;
      }
      setFile(selectedFile);
      setPreview(null);
      setImportResults(null);
    }
  };

  const handlePreview = async () => {
    if (!file) {
      toast.error("Please select a CSV file");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/admin/products/import/preview", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPreview(response.data);
      toast.success("CSV parsed successfully");
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to parse CSV");
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!preview) return;

    const validRows = preview.preview.filter(row => row.isValid);
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setImporting(true);

    try {
      const response = await api.post("/admin/products/import/execute", {
        rows: validRows,
      });
      setImportResults(response.data);
      toast.success(`Successfully imported ${response.data.summary.successful} products`);
      
      // Clear file and preview after successful import
      if (response.data.summary.successful > 0) {
        setFile(null);
        setPreview(null);
      }
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to import products");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = `name,description,price,cost,sku,stock,status,category
Sample Product,This is a sample description,99.99,45.50,SKU-001,100,active,Electronics
Another Product,Another sample,149.99,75.00,SKU-002,50,draft,Electronics`;

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "product-import-template.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const previewRows = preview?.preview ?? [];
  const totalPreviewPages = Math.max(1, Math.ceil(previewRows.length / PAGE_SIZE));
  const safePreviewPage = Math.min(previewPage, totalPreviewPages);
  const paginatedPreviewRows = previewRows.slice(
    (safePreviewPage - 1) * PAGE_SIZE,
    safePreviewPage * PAGE_SIZE
  );

  const failedRows = importResults?.results.failed ?? [];
  const totalFailedPages = Math.max(1, Math.ceil(failedRows.length / PAGE_SIZE));
  const safeFailedPage = Math.min(failedPage, totalFailedPages);
  const paginatedFailedRows = failedRows.slice(
    (safeFailedPage - 1) * PAGE_SIZE,
    safeFailedPage * PAGE_SIZE
  );

  return (
    <AdminShell title="CSV Product Import" ownerOnly>
      <div className="p-6 space-y-6">
        <BackButton />

        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">CSV Product Import</h1>
          <button
            onClick={downloadTemplate}
            className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold hover:border-black/20"
          >
            📥 Download Template
          </button>
        </div>

        {/* Upload Section */}
        <div className="rounded-2xl border border-black/10 bg-white p-6">
          <h2 className="text-xl font-semibold mb-4">Step 1: Upload CSV File</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex-1">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-black/60
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-black file:text-white
                    hover:file:bg-black/80
                    cursor-pointer"
                />
              </label>
              <button
                onClick={handlePreview}
                disabled={!file || uploading}
                className="rounded-full bg-black px-6 py-2 text-xs font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/80"
              >
                {uploading ? "Parsing..." : "Preview Import"}
              </button>
            </div>
            {file && (
              <p className="text-xs text-black/60">
                Selected: <span className="font-semibold">{file.name}</span> ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-900 mb-2">
              CSV Format Requirements
            </p>
            <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>Required columns:</strong> name, price, category</li>
              <li><strong>Optional columns:</strong> description, cost, sku, stock, status</li>
              <li><strong>Category:</strong> Must match existing category names</li>
              <li><strong>Status:</strong> Either &quot;active&quot; or &quot;draft&quot; (default: active)</li>
              <li><strong>Stock:</strong> Numeric value (default: 0)</li>
            </ul>
          </div>
        </div>

        {/* Preview Section */}
        {preview && (
          <div className="rounded-2xl border border-black/10 bg-white p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Step 2: Review & Import</h2>
              <div className="flex items-center gap-4">
                <div className="text-xs space-x-4">
                  <span className="text-green-600 font-semibold">
                    ✓ Valid: {preview.summary.valid}
                  </span>
                  <span className="text-red-600 font-semibold">
                    ✗ Invalid: {preview.summary.invalid}
                  </span>
                  <span className="text-black/60">
                    Total: {preview.summary.total}
                  </span>
                </div>
                <button
                  onClick={handleImport}
                  disabled={preview.summary.valid === 0 || importing}
                  className="rounded-full bg-green-600 px-6 py-2 text-xs font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700"
                >
                  {importing ? "Importing..." : `Import ${preview.summary.valid} Products`}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/5 sticky top-0">
                  <tr>
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Price</th>
                    <th className="px-2 py-2">Cost</th>
                    <th className="px-2 py-2">SKU</th>
                    <th className="px-2 py-2">Stock</th>
                    <th className="px-2 py-2">Category</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPreviewRows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={`border-t border-black/10 ${
                        !row.isValid ? "bg-red-50" : row.warnings.length > 0 ? "bg-yellow-50" : ""
                      }`}
                    >
                      <td className="px-2 py-2 text-black/60">{row.rowNumber}</td>
                      <td className="px-2 py-2 font-medium max-w-xs truncate">
                        {row.data.name}
                      </td>
                      <td className="px-2 py-2">{formatCurrency(row.data.price)}</td>
                      <td className="px-2 py-2">{row.data.cost ? formatCurrency(row.data.cost) : "-"}</td>
                      <td className="px-2 py-2">{row.data.sku || "-"}</td>
                      <td className="px-2 py-2">{row.data.stock}</td>
                      <td className="px-2 py-2">{row.data.category}</td>
                      <td className="px-2 py-2">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                          row.data.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        }`}>
                          {row.data.status}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        {row.errors.length > 0 && (
                          <div className="text-red-600 space-y-1">
                            {row.errors.map((error, idx) => (
                              <div key={idx}>❌ {error}</div>
                            ))}
                          </div>
                        )}
                        {row.warnings.length > 0 && (
                          <div className="text-yellow-600 space-y-1">
                            {row.warnings.map((warning, idx) => (
                              <div key={idx}>⚠️ {warning}</div>
                            ))}
                          </div>
                        )}
                        {row.isValid && row.warnings.length === 0 && (
                          <span className="text-green-600">✓ Ready</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              totalItems={previewRows.length}
              currentPage={safePreviewPage}
              pageSize={PAGE_SIZE}
              onPageChange={setPreviewPage}
              itemLabel="rows"
              className="mt-4"
            />
          </div>
        )}

        {/* Import Results */}
        {importResults && (
          <div className="rounded-2xl border border-black/10 bg-white p-6">
            <h2 className="text-xl font-semibold mb-4">Import Results</h2>
            <div className="grid gap-4 md:grid-cols-3 mb-4">
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <p className="text-2xl font-bold text-green-700">{importResults.summary.successful}</p>
                  <h1 className="text-3xl font-bold">Bulk Product Import</h1>
              </div>
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-2xl font-bold text-red-700">{importResults.summary.failed}</p>
                <p className="text-xs text-red-600">Failed</p>
              </div>
              <div className="rounded-lg bg-black/5 border border-black/10 p-4">
                <p className="text-2xl font-bold text-black">{importResults.summary.total}</p>
                <p className="text-xs text-black/60">Total Processed</p>
              </div>
            </div>

            {importResults.results.failed.length > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-900 mb-2">
                  Failed Imports
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {paginatedFailedRows.map((fail) => (
                    <div key={fail.rowNumber} className="text-xs text-red-800">
                      <strong>Row {fail.rowNumber}:</strong> {fail.data.name} - {fail.error}
                    </div>
                  ))}
                </div>
                <PaginationControls
                  totalItems={failedRows.length}
                  currentPage={safeFailedPage}
                  pageSize={PAGE_SIZE}
                  onPageChange={setFailedPage}
                  itemLabel="failed imports"
                  className="mt-4"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
