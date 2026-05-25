import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const NAV = [
  { to: "/", label: "Dashboard", icon: "⬛" },
  { to: "/upload", label: "Upload Center", icon: "⬆" },
  { to: "/review", label: "Review Queue", icon: "✓" },
  { to: "/audit", label: "Audit Timeline", icon: "📋" },
];

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-700/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center">
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
              <span className="text-base leading-none">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-gray-700/60">
          <div className="text-gray-400 text-xs mb-1 truncate">{user?.full_name}</div>
          <div className="text-gray-500 text-xs truncate mb-3">{user?.tenant?.name}</div>
          <button
            onClick={handleSignOut}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
