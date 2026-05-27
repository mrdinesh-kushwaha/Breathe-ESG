import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isAnalyst = user?.role === "analyst" || user?.role === "admin";
  const isReviewer = user?.role === "reviewer" || user?.role === "admin";

  const NAV = [
    { to: "/", label: "Dashboard", show: true, icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    )},
    { to: "/upload", label: "Upload", show: isAnalyst, icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    )},
    { to: "/review", label: "Review", show: isReviewer, icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
    )},
    { to: "/audit", label: "Audit", show: true, icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    )},
  ].filter(n => n.show);

  const handleSignOut = () => {
    signOut();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      <aside className="hidden lg:flex w-56 bg-gray-900 flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-700/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">B</span>
            </div>
            <div>
              <div className="text-white text-sm font-semibold leading-tight">Breathe</div>
              <div className="text-gray-400 text-xs">ESG Platform</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-green-500/20 text-green-400 font-medium"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
                }`
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-gray-700/60">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
              <span className="text-green-400 text-xs font-bold">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-gray-300 text-xs font-medium truncate">{user?.full_name}</div>
              <div className="text-gray-500 text-xs truncate">{user?.tenant?.name}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ─────────────────────────────────────────
          MOBILE TOP BAR (hidden on desktop)
      ───────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">B</span>
          </div>
          <div>
            <div className="text-white text-sm font-semibold leading-none">Breathe ESG</div>
            <div className="text-gray-400 text-xs">ESG Platform</div>
          </div>
        </div>
        {/* User avatar */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-gray-300 text-xs font-medium">{user?.first_name}</div>
            <div className="text-gray-500 text-xs capitalize">{user?.role}</div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-gray-400">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────
          MAIN CONTENT
      ───────────────────────────────────────── */}
      <main className="flex-1 overflow-auto lg:mt-0 mt-14 mb-16 lg:mb-0">
        <Outlet />
      </main>

      {/* ─────────────────────────────────────────
          MOBILE BOTTOM NAV (hidden on desktop)
      ───────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-700/60">
        <div className="flex items-center justify-around px-2 py-2">
          {NAV.map(({ to, label, icon }) => {
            const isActive = to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors min-w-0"
                style={{
                  color: isActive ? "#22c55e" : "#6b7280",
                  background: isActive ? "rgba(34,197,94,0.1)" : "transparent",
                }}
              >
                {icon}
                <span className="text-xs font-medium">{label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

    </div>
  );
}