import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getDashboardStats } from "../api/client";

function StatCard({ label, value, sub, color = "gray" }) {
  const colors = {
    green: "text-green-600 bg-green-50",
    yellow: "text-yellow-600 bg-yellow-50",
    red: "text-red-600 bg-red-50",
    blue: "text-blue-600 bg-blue-50",
    gray: "text-gray-700 bg-gray-50",
  };
  return (
    <div className="card p-5">
      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-3xl font-bold ${colors[color].split(" ")[0]} mb-1`}>{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function ScopeBadge({ scope }) {
  const map = {
    scope_1: { label: "Scope 1", cls: "bg-orange-100 text-orange-700" },
    scope_2: { label: "Scope 2", cls: "bg-blue-100 text-blue-700" },
    scope_3: { label: "Scope 3", cls: "bg-purple-100 text-purple-700" },
  };
  const s = map[scope] || { label: scope, cls: "bg-gray-100 text-gray-600" };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

function SourceBadge({ type }) {
  const map = {
    sap_export: { label: "SAP", cls: "bg-blue-100 text-blue-700" },
    utility_portal: { label: "Utility", cls: "bg-yellow-100 text-yellow-700" },
    travel_api: { label: "Travel", cls: "bg-green-100 text-green-700" },
  };
  const s = map[type] || { label: type, cls: "bg-gray-100 text-gray-600" };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

function StatusBadge({ status }) {
  const map = {
    complete: "bg-green-100 text-green-700",
    processing: "bg-blue-100 text-blue-700",
    failed: "bg-red-100 text-red-700",
    pending: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`badge ${map[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getDashboardStats()
      .then((r) => setStats(r.data))
      .catch(() => setError("Failed to load dashboard stats."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-red-500">{error}</div>;
  }

  const { records, batches, emissions_by_scope } = stats;
  const totalEmissions = emissions_by_scope.reduce((s, e) => s + e.total_emissions, 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">ESG emissions overview</p>
        </div>
        <Link to="/upload" className="btn-primary">
          New Upload
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Records"
          value={records.total.toLocaleString()}
          sub={`${batches.total} upload batches`}
        />
        <StatCard
          label="Pending Review"
          value={records.pending.toLocaleString()}
          sub="awaiting analyst decision"
          color="yellow"
        />
        <StatCard
          label="Suspicious Rows"
          value={records.suspicious.toLocaleString()}
          sub="flagged during ingestion"
          color="red"
        />
        <StatCard
          label="Approved"
          value={records.approved.toLocaleString()}
          sub={`${totalEmissions > 0 ? (totalEmissions / 1000).toFixed(1) + " t CO₂e" : "—"} total`}
          color="green"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Emissions by scope */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Approved Emissions by Scope</h2>
          {emissions_by_scope.length === 0 ? (
            <p className="text-gray-400 text-sm">No approved records yet.</p>
          ) : (
            <div className="space-y-3">
              {emissions_by_scope.map((row) => {
                const pct = totalEmissions > 0 ? (row.total_emissions / totalEmissions) * 100 : 0;
                return (
                  <div key={row.scope_category}>
                    <div className="flex items-center justify-between mb-1">
                      <ScopeBadge scope={row.scope_category} />
                      <span className="text-sm font-medium text-gray-700">
                        {(row.total_emissions / 1000).toFixed(2)} t CO₂e
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{row.count} records · {pct.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent batches */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Recent Uploads</h2>
            <Link to="/upload" className="text-xs text-green-600 hover:text-green-700">
              View all →
            </Link>
          </div>
          {batches.recent.length === 0 ? (
            <p className="text-gray-400 text-sm">No uploads yet.</p>
          ) : (
            <div className="space-y-3">
              {batches.recent.map((batch) => (
                <div key={batch.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm text-gray-800 font-medium truncate max-w-40">
                      {batch.original_filename || "Unnamed upload"}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <SourceBadge type={batch["data_source__source_type"]} />
                      <span className="text-xs text-gray-400">
                        {batch.total_rows} rows
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={batch.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      {records.pending > 0 && (
        <div className="mt-6 card p-4 flex items-center justify-between bg-yellow-50 border-yellow-100">
          <div>
            <span className="text-yellow-800 text-sm font-medium">
              {records.pending} records pending review
            </span>
            <span className="text-yellow-600 text-sm ml-2">
              {records.suspicious > 0 && `(${records.suspicious} flagged suspicious)`}
            </span>
          </div>
          <Link to="/review" className="btn-primary text-sm">
            Go to Review Queue →
          </Link>
        </div>
      )}
    </div>
  );
}
