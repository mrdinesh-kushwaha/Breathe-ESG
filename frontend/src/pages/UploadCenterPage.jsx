import { useState, useEffect, useRef } from "react";
import { getDataSources, createDataSource, uploadSAP, uploadUtility, uploadTravel } from "../api/client";

const SOURCE_TYPES = [
  { value: "sap_export", label: "SAP Export", description: "Fuel & procurement CSV from SAP ECC/S4" },
  { value: "utility_portal", label: "Utility Portal", description: "Electricity billing CSV from grid portal" },
  { value: "travel_api", label: "Travel API", description: "JSON export from Concur or Navan" },
];

function SourceTypeBadge({ type }) {
  const map = {
    sap_export: "bg-blue-100 text-blue-700",
    utility_portal: "bg-yellow-100 text-yellow-700",
    travel_api: "bg-green-100 text-green-700",
  };
  return (
    <span className={`badge ${map[type] || "bg-gray-100 text-gray-600"}`}>
      {SOURCE_TYPES.find((s) => s.value === type)?.label || type}
    </span>
  );
}

function UploadResult({ result }) {
  if (!result) return null;
  const isError = result.error;
  return (
    <div className={`mt-4 p-4 rounded-lg border text-sm ${isError ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-800"}`}>
      {isError ? (
        <div><strong>Upload failed:</strong> {result.error}</div>
      ) : (
        <div>
          <div className="font-medium mb-1">Upload successful — Batch ID: <span className="font-mono text-xs">{result.batch_id}</span></div>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div className="text-center p-2 bg-white rounded border border-green-100">
              <div className="text-lg font-bold text-gray-800">{result.summary.total_rows}</div>
              <div className="text-xs text-gray-500">Total rows</div>
            </div>
            <div className="text-center p-2 bg-white rounded border border-green-100">
              <div className="text-lg font-bold text-gray-800">{result.summary.processed_rows}</div>
              <div className="text-xs text-gray-500">Normalised</div>
            </div>
            <div className="text-center p-2 bg-white rounded border border-red-100">
              <div className={`text-lg font-bold ${result.summary.flagged_rows > 0 ? "text-red-600" : "text-gray-800"}`}>{result.summary.flagged_rows}</div>
              <div className="text-xs text-gray-500">Flagged</div>
            </div>
          </div>
          {result.summary.errors?.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-medium text-red-700 mb-1">Parse errors (first 10):</div>
              {result.summary.errors.map((e, i) => (
                <div key={i} className="text-xs font-mono text-red-600 mb-0.5">{e}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function UploadCenterPage() {
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  // New source form
  const [showNewSource, setShowNewSource] = useState(false);
  const [newSource, setNewSource] = useState({ name: "", source_type: "sap_export", description: "" });
  const [creatingSource, setCreatingSource] = useState(false);

  useEffect(() => {
    getDataSources().then((r) => setSources(r.data.results || r.data));
  }, []);

  const selectedSourceObj = sources.find((s) => s.id === selectedSource);

  const handleUpload = async () => {
    if (!selectedSource || !file) return;
    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("data_source_id", selectedSource);
    formData.append("file", file);

    try {
      let res;
      const type = selectedSourceObj?.source_type;
      if (type === "sap_export") res = await uploadSAP(formData);
      else if (type === "utility_portal") res = await uploadUtility(formData);
      else if (type === "travel_api") res = await uploadTravel(formData);
      else throw new Error("Unknown source type");
      setResult(res.data);
    } catch (err) {
      setResult({ error: err.response?.data?.detail || err.message });
    } finally {
      setUploading(false);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleCreateSource = async (e) => {
    e.preventDefault();
    setCreatingSource(true);
    try {
      const res = await createDataSource(newSource);
      setSources((prev) => [...prev, res.data]);
      setSelectedSource(res.data.id);
      setShowNewSource(false);
      setNewSource({ name: "", source_type: "sap_export", description: "" });
    } catch (err) {
      alert("Failed to create source: " + (err.response?.data?.name?.[0] || err.message));
    } finally {
      setCreatingSource(false);
    }
  };

  const acceptedFileType = selectedSourceObj?.source_type === "travel_api" ? ".json" : ".csv";

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Center</h1>
        <p className="text-gray-500 text-sm mt-0.5">Ingest SAP exports, utility CSVs, or travel JSON payloads</p>
      </div>

      {/* Data source selector */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">1. Select Data Source</h2>
          <button
            onClick={() => setShowNewSource(!showNewSource)}
            className="text-xs text-green-600 hover:text-green-700 font-medium"
          >
            {showNewSource ? "Cancel" : "+ New source"}
          </button>
        </div>

        {showNewSource && (
          <form onSubmit={handleCreateSource} className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Source Name</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  placeholder="e.g. SAP ECC — DE Plants"
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Type</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 bg-white"
                  value={newSource.source_type}
                  onChange={(e) => setNewSource({ ...newSource, source_type: e.target.value })}
                >
                  {SOURCE_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Description (optional)</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                placeholder="e.g. Monthly fuel procurement data from DE01/DE02 plants"
                value={newSource.description}
                onChange={(e) => setNewSource({ ...newSource, description: e.target.value })}
              />
            </div>
            <button type="submit" disabled={creatingSource} className="btn-primary text-xs">
              {creatingSource ? "Creating…" : "Create Source"}
            </button>
          </form>
        )}

        <div className="space-y-2">
          {sources.length === 0 && (
            <p className="text-gray-400 text-sm">No data sources configured. Create one above.</p>
          )}
          {sources.map((s) => (
            <label
              key={s.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedSource === s.id
                  ? "border-green-400 bg-green-50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <input
                type="radio"
                name="source"
                value={s.id}
                checked={selectedSource === s.id}
                onChange={() => { setSelectedSource(s.id); setResult(null); setFile(null); }}
                className="mt-0.5"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{s.name}</span>
                  <SourceTypeBadge type={s.source_type} />
                </div>
                {s.description && <div className="text-xs text-gray-400 mt-0.5">{s.description}</div>}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* File upload */}
      {selectedSource && (
        <div className="card p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            2. Upload File
            <span className="ml-2 text-xs font-normal text-gray-400">
              {selectedSourceObj?.source_type === "travel_api" ? "JSON" : "CSV"} format expected
            </span>
          </h2>

          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-green-300 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            {file ? (
              <div>
                <div className="text-green-600 font-medium text-sm">{file.name}</div>
                <div className="text-gray-400 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</div>
              </div>
            ) : (
              <div>
                <div className="text-gray-400 text-sm">Click to select file or drag and drop</div>
                <div className="text-gray-300 text-xs mt-1">{acceptedFileType.toUpperCase()} files only</div>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={acceptedFileType}
              className="hidden"
              onChange={(e) => { setFile(e.target.files[0] || null); setResult(null); }}
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="btn-primary"
            >
              {uploading ? "Processing…" : "Upload & Ingest"}
            </button>
            {file && (
              <button
                onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="btn-secondary text-xs"
              >
                Clear
              </button>
            )}
          </div>

          <UploadResult result={result} />
        </div>
      )}

      {/* Format hints */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Supported Formats</h2>
        <div className="space-y-3">
          {SOURCE_TYPES.map((s) => (
            <div key={s.value} className="flex items-start gap-3">
              <SourceTypeBadge type={s.value} />
              <span className="text-xs text-gray-500">{s.description}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">
          SAP exports support German headers (Menge, Einheit, Buchungsdatum) and mixed date formats.
          Column mapping can be configured per data source.
        </p>
      </div>
    </div>
  );
}
