import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getRecord, reviewRecord, getRecordAudit } from "../api/client";

function Field({ label, value, mono = false, highlight = false }) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? "bg-yellow-50 border border-yellow-100" : "bg-gray-50"}`}>
      <div className="text-xs text-gray-400 font-medium mb-0.5">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""} ${highlight ? "text-yellow-800" : "text-gray-800"} break-all`}>
        {value ?? <span className="text-gray-300">—</span>}
      </div>
    </div>
  );
}

function ScopeBadge({ scope }) {
  const map = {
    scope_1: { label: "Scope 1 — Direct", cls: "bg-orange-100 text-orange-700" },
    scope_2: { label: "Scope 2 — Electricity", cls: "bg-blue-100 text-blue-700" },
    scope_3: { label: "Scope 3 — Value Chain", cls: "bg-purple-100 text-purple-700" },
  };
  const s = map[scope] || { label: scope, cls: "bg-gray-100 text-gray-600" };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

export default function RecordDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    Promise.all([getRecord(id), getRecordAudit(id)])
      .then(([recRes, auditRes]) => {
        setRecord(recRes.data);
        setAudit(auditRes.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleReview = async (action) => {
    setActionLoading(true);
    setActionError("");
    try {
      await reviewRecord(id, action, comment);
      // Reload record
      const res = await getRecord(id);
      setRecord(res.data);
      const auditRes = await getRecordAudit(id);
      setAudit(auditRes.data);
      setComment("");
    } catch (err) {
      setActionError(err.response?.data?.detail || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!record) {
    return <div className="p-8 text-red-500">Record not found.</div>;
  }

  const isImmutable = record.review_status === "approved";

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/review" className="hover:text-gray-600">Review Queue</Link>
        <span>›</span>
        <span className="text-gray-600 font-mono text-xs">{id.slice(0, 8)}…</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{record.activity_type.replace(/_/g, " ")}</h1>
          <div className="flex items-center gap-2 mt-1">
            <ScopeBadge scope={record.scope_category} />
            <span className={`badge ${
              record.review_status === "approved" ? "bg-green-100 text-green-700" :
              audit.length > 0 && audit[0].action === "flag" ? "bg-yellow-100 text-yellow-700" :
              record.review_status === "rejected" ? "bg-red-100 text-red-700" :
              "bg-yellow-100 text-yellow-700"
            }`}>{audit.length > 0 && audit[0].action === "flag" ? "Flagged" : record.review_status}</span>
            {record.suspicious_flag && (
              <span className="badge bg-red-100 text-red-600">⚠ Suspicious</span>
            )}
            {isImmutable && (
              <span className="badge bg-gray-100 text-gray-500">🔒 Immutable</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-gray-900">{record.estimated_emissions.toFixed(2)}</div>
          <div className="text-sm text-gray-400">kg CO₂e</div>
        </div>
      </div>

      {/* Suspicious warning */}
      {record.suspicious_flag && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="text-red-700 text-sm font-medium mb-0.5">⚠ Flagged during ingestion</div>
          <div className="text-red-600 text-sm">{record.suspicious_reason}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Emissions calculation */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Emissions Calculation</h2>
          <div className="space-y-2">
            <Field label="Original Value" value={`${record.original_value} ${record.original_unit}`} />
            <Field label="Normalised Value" value={`${record.normalized_value} ${record.normalized_unit}`} />
            <Field label="Emission Factor" value={`${record.emission_factor} kg CO₂e / ${record.normalized_unit}`} mono />
            <div className="p-3 bg-green-50 rounded-lg border border-green-100">
              <div className="text-xs text-green-600 font-medium mb-0.5">Estimated Emissions</div>
              <div className="text-lg font-bold text-green-800">{record.estimated_emissions.toFixed(4)} kg CO₂e</div>
            </div>
          </div>
        </div>

        {/* Source metadata */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Source Metadata</h2>
          <div className="space-y-2">
            <Field label="Source Type" value={record.source_type_display} />
            <Field label="Source Row ID" value={record.source_row_id} mono />
            <Field label="Reporting Period" value={
              record.period_start
                ? `${record.period_start}${record.period_end ? ` → ${record.period_end}` : ""}`
                : null
            } />
            <Field label="Ingested" value={new Date(record.created_at).toLocaleString()} />
          </div>
        </div>
      </div>

      {/* Raw record */}
      {record.raw_record && (
        <div className="card p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Raw Source Data (Row {record.raw_record.row_index})</h2>
          <pre className="text-xs font-mono text-gray-600 bg-gray-50 p-3 rounded-lg overflow-auto max-h-48">
            {JSON.stringify(record.raw_record.raw_data, null, 2)}
          </pre>
          {record.raw_record.parse_error && (
            <div className="mt-2 text-xs text-red-500">Parse warning: {record.raw_record.parse_error}</div>
          )}
        </div>
      )}

      {/* Review action */}
      {!isImmutable && record.review_status !== "rejected" && (
        <div className="card p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Review Decision</h2>
          {actionError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{actionError}</div>
          )}
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400 resize-none"
            rows={3}
            placeholder="Add a comment (optional)…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex gap-3 mt-3">
            <button
              onClick={() => handleReview("approve")}
              disabled={actionLoading}
              className="btn-primary"
            >
              {actionLoading ? "Processing…" : "Approve"}
            </button>
            <button
              onClick={() => handleReview("reject")}
              disabled={actionLoading}
              className="btn-danger"
            >
              Reject
            </button>
            <button
              onClick={() => handleReview("flag")}
              disabled={actionLoading}
              className="btn-secondary"
            >
              Flag for follow-up
            </button>
          </div>
        </div>
      )}

      {isImmutable && (
        <div className="card p-4 mb-6 bg-green-50 border-green-100">
          <div className="text-green-700 text-sm font-medium">
            🔒 Approved by {record.approved_by_name} on {new Date(record.approved_at).toLocaleString()}
          </div>
          <div className="text-green-600 text-xs mt-0.5">This record is immutable and cannot be modified.</div>
        </div>
      )}

      {/* Audit trail */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Audit Trail</h2>
        {audit.length === 0 ? (
          <p className="text-gray-400 text-sm">No audit events yet.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100" />
            <div className="space-y-4">
              {audit.map((entry) => (
                <div key={entry.id} className="flex gap-4 relative pl-10">
                  <div className="absolute left-3 top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-green-400" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`badge text-xs ${
                        entry.action === "approve" ? "bg-green-100 text-green-700" :
                        entry.action === "reject" ? "bg-red-100 text-red-700" :
                        entry.action === "flag" ? "bg-yellow-100 text-yellow-700" :
                        entry.action === "ingest" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{entry.action === "flag" ? "Flagged" : entry.action_display}</span>
                      <span className="text-sm text-gray-600 font-medium">{entry.actor_name || entry.actor_email}</span>
                      <span className="text-xs text-gray-400">{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    {entry.field_name && (
                      <div className="mt-1 text-xs text-gray-500 font-mono">
                        {entry.field_name}: <span className="text-red-400">{entry.old_value}</span> → <span className={entry.new_value === "rejected" ? "text-red-600" : entry.new_value === "pending" && (entry.action === "reject" || entry.action === "flag") ? "text-yellow-700" : "text-green-600"}>{entry.new_value}</span>
                      </div>
                    )}
                    {entry.note && (
                      <div className="mt-1 text-xs text-gray-400 italic">"{entry.note}"</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
