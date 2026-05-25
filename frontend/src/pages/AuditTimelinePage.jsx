import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAuditLog } from "../api/client";

const ACTION_STYLES = {
  ingest: "bg-blue-100 text-blue-700",
  approve: "bg-green-100 text-green-700",
  reject: "bg-red-100 text-red-700",
  create: "bg-gray-100 text-gray-600",
  update: "bg-yellow-100 text-yellow-700",
  flag: "bg-orange-100 text-orange-700",
};

export default function AuditTimelinePage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditLog()
      .then((r) => setLogs(r.data.results || r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Audit Timeline</h1>
        <p className="text-gray-500 text-sm mt-0.5">Append-only log of all platform events</p>
      </div>

      {logs.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">No audit events yet.</div>
      ) : (
        <div className="card p-6">
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100" />
            <div className="space-y-5">
              {logs.map((entry) => (
                <div key={entry.id} className="flex gap-4 relative pl-10">
                  <div className="absolute left-3 top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-gray-300" />
                  <div className="flex-1 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`badge ${
                        (entry.action === "reject" && entry.new_value === "pending") || entry.action === "flag"
                          ? "bg-yellow-100 text-yellow-700"
                          : ACTION_STYLES[entry.action] || "bg-gray-100 text-gray-600"
                      }`}>
                        {(entry.action === "reject" && entry.new_value === "pending") || entry.action === "flag"
                          ? "Flagged"
                          : entry.action_display}
                      </span>
                      <span className="text-sm text-gray-700 font-medium">
                        {entry.actor_name || entry.actor_email || "System"}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {entry.model_name && (
                        <span className="text-xs text-gray-400 capitalize">{entry.model_name}</span>
                      )}
                      {entry.object_id && entry.model_name === "normalizedrecord" && (
                        <Link
                          to={`/records/${entry.object_id}`}
                          className="text-xs text-blue-500 hover:text-blue-700 font-mono"
                        >
                          {entry.object_id.slice(0, 8)}…
                        </Link>
                      )}
                    </div>

                    {entry.field_name && (
                      <div className="mt-1.5 text-xs font-mono text-gray-500 bg-gray-50 rounded px-2 py-1 inline-block">
                        <span className="text-gray-400">{entry.field_name}:</span>{" "}
                        <span className="text-red-400 line-through">{entry.old_value || "—"}</span>
                        {" → "}
                        <span className={
                          entry.field_name === "review_status" && entry.new_value === "rejected"
                            ? "text-red-600"
                            : entry.field_name === "review_status" && (entry.new_value === "pending" && (entry.action === "reject" || entry.action === "flag"))
                            ? "text-yellow-700"
                            : "text-green-600"
                        }>
                          {entry.new_value || "—"}
                        </span>
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

          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
            Showing last {logs.length} events. Audit log is append-only and cannot be modified.
          </div>
        </div>
      )}
    </div>
  );
}
