import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { getRecords, reviewRecord, bulkReview } from "../api/client";
import { useAuth } from "../hooks/useAuth";

function ScopeBadge({ scope }) {
  const map = {
    scope_1: { label: "Scope 1", cls: "bg-orange-100 text-orange-700" },
    scope_2: { label: "Scope 2", cls: "bg-blue-100 text-blue-700" },
    scope_3: { label: "Scope 3", cls: "bg-purple-100 text-purple-700" },
  };
  const s = map[scope] || { label: scope, cls: "bg-gray-100 text-gray-600" };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

function StatusBadge({ status }) {
  const map = {
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span className={`badge ${map[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

function SourceBadge({ type }) {
  const map = {
    sap_export: "bg-blue-100 text-blue-700",
    utility_portal: "bg-yellow-100 text-yellow-700",
    travel_api: "bg-green-100 text-green-700",
  };
  const labels = { sap_export: "SAP", utility_portal: "Utility", travel_api: "Travel" };
  return (
    <span className={`badge ${map[type] || "bg-gray-100 text-gray-600"}`}>
      {labels[type] || type}
    </span>
  );
}

// ── Mobile Card ──
function RecordCard({ rec, isReviewer, onReview, actionLoading, selected, onToggle }) {
  return (
    <div
      className={`card p-4 mb-3 transition-all ${selected ? "ring-2 ring-blue-400" : ""}`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            disabled={rec.review_status === "approved"}
            className="rounded mt-0.5"
          />
          <SourceBadge type={rec.source_type} />
          <ScopeBadge scope={rec.scope_category} />
        </div>
        <StatusBadge status={rec.review_status} />
      </div>

      {/* Activity */}
      <div className="mb-2">
        <div className="text-gray-800 font-semibold text-sm capitalize">
          {rec.activity_type.replace(/_/g, " ")}
        </div>
        {rec.source_row_id && (
          <div className="text-xs text-gray-400 font-mono mt-0.5">{rec.source_row_id}</div>
        )}
        {rec.period_start && (
          <div className="text-xs text-gray-400 mt-0.5">{rec.period_start}</div>
        )}
      </div>

      {/* Emissions */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-gray-400">Estimated Emissions</div>
          <div className="text-lg font-bold text-gray-800 font-mono">
            {rec.estimated_emissions.toFixed(2)}
            <span className="text-xs font-normal text-gray-400 ml-1">kg CO₂e</span>
          </div>
        </div>
        {rec.suspicious_flag && (
          <div className="flex flex-col items-end">
            <span className="badge bg-red-100 text-red-600 text-xs">⚠ Flagged</span>
            <span className="text-xs text-red-400 mt-0.5 max-w-32 text-right leading-tight">
              {rec.suspicious_reason?.slice(0, 50)}...
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        <Link
          to={`/records/${rec.id}`}
          className="flex-1 text-center py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          View Details
        </Link>
        {rec.review_status === "pending" && isReviewer && (
          <>
            <button
              onClick={() => onReview(rec.id, "approve")}
              disabled={actionLoading}
              className="flex-1 py-2 rounded-lg text-xs font-medium bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-40"
            >
              ✓ Approve
            </button>
            <button
              onClick={() => onReview(rec.id, "reject")}
              disabled={actionLoading}
              className="flex-1 py-2 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-40"
            >
              ✕ Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ReviewQueuePage() {
  const { user } = useAuth();
  const isReviewer = user?.role === "reviewer" || user?.role === "admin";

  const [records, setRecords] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ review_status: "pending", suspicious_flag: "" });
  const [selected, setSelected] = useState(new Set());
  const [bulkComment, setBulkComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [page, setPage] = useState(1);

  const fetchRecords = useCallback(() => {
    setLoading(true);
    const params = { page };
    if (filters.review_status) params.review_status = filters.review_status;
    if (filters.suspicious_flag !== "") params.suspicious_flag = filters.suspicious_flag;
    getRecords(params)
      .then((r) => {
        const data = r.data;
        setRecords(data.results || data);
        setCount(data.count || (data.results || data).length);
      })
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === records.length) setSelected(new Set());
    else setSelected(new Set(records.map((r) => r.id)));
  };

  const handleSingleReview = async (id, action) => {
    setActionLoading(true);
    try {
      await reviewRecord(id, action, "");
      fetchRecords();
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch (err) {
      alert(err.response?.data?.detail || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkAction = async (action) => {
    if (selected.size === 0) return;
    setActionLoading(true);
    try {
      await bulkReview([...selected], action, bulkComment);
      setBulkComment("");
      setSelected(new Set());
      fetchRecords();
    } catch (err) {
      alert(err.response?.data?.detail || "Bulk action failed");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-gray-500 text-sm mt-0.5">{count} records match current filters</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-28">
            <label className="text-xs text-gray-500 font-medium block mb-1">Status</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-400"
              value={filters.review_status}
              onChange={(e) => { setFilters({ ...filters, review_status: e.target.value }); setPage(1); }}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="flex-1 min-w-28">
            <label className="text-xs text-gray-500 font-medium block mb-1">Suspicious</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-400"
              value={filters.suspicious_flag}
              onChange={(e) => { setFilters({ ...filters, suspicious_flag: e.target.value }); setPage(1); }}
            >
              <option value="">All</option>
              <option value="true">Flagged only</option>
              <option value="false">Clean only</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={fetchRecords} className="btn-secondary text-xs h-9 px-4">
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && isReviewer && (
        <div className="card p-3 mb-4 bg-blue-50 border-blue-100">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-sm text-blue-700 font-medium">{selected.size} selected</span>
          </div>
          <input
            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white mb-2 focus:outline-none"
            placeholder="Optional comment…"
            value={bulkComment}
            onChange={(e) => setBulkComment(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction("approve")}
              disabled={actionLoading}
              className="flex-1 py-2 rounded-lg text-xs font-semibold bg-green-500 text-white hover:bg-green-600 disabled:opacity-40"
            >
              ✓ Approve All
            </button>
            <button
              onClick={() => handleBulkAction("reject")}
              disabled={actionLoading}
              className="flex-1 py-2 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-40"
            >
              ✕ Reject All
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-2 rounded-lg text-xs text-gray-500 bg-white border border-gray-200"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && records.length === 0 && (
        <div className="card p-10 text-center text-gray-400">
          No records match the current filters.
        </div>
      )}

      {/* ── MOBILE CARDS (hidden on lg) ── */}
      {!loading && records.length > 0 && (
        <>
          {/* Select all — mobile */}
          <div className="lg:hidden flex items-center gap-2 mb-3 px-1">
            <input
              type="checkbox"
              checked={selected.size === records.length && records.length > 0}
              onChange={toggleAll}
              className="rounded"
            />
            <span className="text-xs text-gray-500">Select all</span>
          </div>

          <div className="lg:hidden">
            {records.map((rec) => (
              <RecordCard
                key={rec.id}
                rec={rec}
                isReviewer={isReviewer}
                onReview={handleSingleReview}
                actionLoading={actionLoading}
                selected={selected.has(rec.id)}
                onToggle={() => toggleSelect(rec.id)}
              />
            ))}
          </div>

          {/* ── DESKTOP TABLE (hidden on mobile) ── */}
          <div className="hidden lg:block card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selected.size === records.length && records.length > 0}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Activity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Scope</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">kg CO₂e</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Flag</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr
                    key={rec.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected.has(rec.id) ? "bg-blue-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(rec.id)}
                        onChange={() => toggleSelect(rec.id)}
                        disabled={rec.review_status === "approved"}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <SourceBadge type={rec.source_type} />
                      {rec.source_row_id && (
                        <div className="text-xs text-gray-400 font-mono mt-0.5 truncate max-w-24">{rec.source_row_id}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-800 font-medium capitalize">{rec.activity_type.replace(/_/g, " ")}</div>
                      {rec.period_start && <div className="text-xs text-gray-400">{rec.period_start}</div>}
                    </td>
                    <td className="px-4 py-3"><ScopeBadge scope={rec.scope_category} /></td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{rec.estimated_emissions.toFixed(2)}</td>
                    <td className="px-4 py-3"><StatusBadge status={rec.review_status} /></td>
                    <td className="px-4 py-3">
                      {rec.suspicious_flag ? (
                        <span className="badge bg-red-100 text-red-600" title={rec.suspicious_reason}>⚠ Flagged</span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/records/${rec.id}`} className="text-xs text-blue-500 hover:text-blue-700">View</Link>
                        {rec.review_status === "pending" && isReviewer && (
                          <>
                            <button onClick={() => handleSingleReview(rec.id, "approve")} disabled={actionLoading} className="text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-40">Approve</button>
                            <button onClick={() => handleSingleReview(rec.id, "reject")} disabled={actionLoading} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40">Reject</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-xs text-gray-400">Page {page}</span>
        <div className="flex gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs disabled:opacity-40">Previous</button>
          <button onClick={() => setPage((p) => p + 1)} disabled={records.length < 50} className="btn-secondary text-xs disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}