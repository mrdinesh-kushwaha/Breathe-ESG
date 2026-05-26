import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { login } from "../api/client";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await login(email, password);
      signIn(data);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: "#080f1a" }}>

      {/* ── TOP BAR — Mobile & Tablet only ── */}
      <div
        className="lg:hidden flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
          >
            <span className="text-white font-bold text-sm">B</span>
          </div>
          <div>
            <div className="text-white font-semibold text-base leading-none">Breathe ESG</div>
            <div className="text-green-400 text-xs mt-0.5">Emissions Intelligence</div>
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-xs font-medium">Enterprise</span>
        </div>
      </div>

      {/* ── MOBILE HERO BANNER ── */}
      <div
        className="lg:hidden px-5 py-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a3d2e 100%)" }}
      >
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(34,197,94,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.3) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
        {/* Glow */}
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #22c55e 0%, transparent 70%)" }}
        />

        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-2">
            Track. Analyse.<br />
            <span className="text-green-400">Reduce.</span>
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-5 max-w-sm">
            Ingest emissions data from SAP, utility portals, and travel systems with full audit trail.
          </p>

          {/* Stats — horizontal scroll on very small screens */}
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { value: "Scope 1–3", label: "Coverage" },
              { value: "100%", label: "Audit Trail" },
              { value: "Real-time", label: "Analytics" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex-shrink-0 px-4 py-3 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  minWidth: "110px",
                }}
              >
                <div className="text-green-400 font-bold text-sm">{stat.value}</div>
                <div className="text-gray-500 text-xs mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── LEFT PANEL — Desktop only ── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d2137 40%, #0a3d2e 100%)" }}
      >
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(34,197,94,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.3) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
        {/* Glow effects */}
        <div
          className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #22c55e 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)" }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
            >
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <div>
              <div className="text-white font-semibold text-lg leading-none">Breathe ESG</div>
              <div className="text-green-400 text-xs mt-0.5">Emissions Intelligence</div>
            </div>
          </div>

          {/* Middle */}
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
              style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-medium">Enterprise Grade Platform</span>
            </div>

            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Track. Analyse.<br />
              <span className="text-green-400">Reduce.</span>
            </h1>
            <p className="text-gray-400 text-base leading-relaxed max-w-sm">
              Ingest emissions data from SAP, utility portals, and travel systems.
              Review, approve, and report with full audit trail.
            </p>

            <div className="grid grid-cols-3 gap-4 mt-10">
              {[
                { value: "Scope 1–3", label: "Coverage" },
                { value: "100%", label: "Audit Trail" },
                { value: "Real-time", label: "Analytics" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-4 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="text-green-400 font-bold text-sm">{stat.value}</div>
                  <div className="text-gray-500 text-xs mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-gray-600 text-xs">
            © 2024 Breathe ESG. Enterprise Emissions Management.
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Login Form (all screens) ── */}
      <div className="flex-1 lg:w-1/2 flex items-center justify-center px-5 sm:px-8 py-8 lg:py-0">
        <div className="w-full max-w-sm">

          <div className="mb-7 lg:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Welcome back</h2>
            <p className="text-gray-500 text-sm">Sign in to your workspace</p>
          </div>

          {error && (
            <div
              className="mb-5 p-3.5 rounded-xl flex items-start gap-3"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.15)",
              }}
            >
              <span className="text-red-400 text-sm mt-0.5">⚠</span>
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-4 py-3 rounded-xl text-white text-sm placeholder-gray-600 outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontSize: "16px", // 16px — mobile par auto zoom nahi hoga
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(34,197,94,0.5)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl text-white text-sm placeholder-gray-600 outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontSize: "16px",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(34,197,94,0.5)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: loading
                  ? "rgba(34,197,94,0.5)"
                  : "linear-gradient(135deg, #22c55e, #16a34a)",
                boxShadow: loading ? "none" : "0 0 30px rgba(34,197,94,0.25)",
                fontSize: "15px",
                minHeight: "48px", // touch friendly
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign in →"
              )}
            </button>
          </form>

          {/* Trust badges */}
          <div
            className="mt-8 pt-6"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap">
              {["SOC 2", "GHG Protocol", "DEFRA 2023"].map((badge) => (
                <div key={badge} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 opacity-60" />
                  <span className="text-gray-600 text-xs">{badge}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Copyright — Mobile only */}
          <div className="lg:hidden text-center mt-6">
            <span className="text-gray-700 text-xs">
              © 2024 Breathe ESG. Enterprise Emissions Management.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}