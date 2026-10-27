// Top bar on the flat pages: links, score, and log out.
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../AuthContext";

const linkClass = ({ isActive }) =>
  isActive ? "text-emerald-800 font-semibold" : "text-stone-600 hover:text-stone-900";

export default function NavBar() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <Link to="/browse" className="font-semibold text-stone-900">
          Two Truths
        </Link>
        <nav className="flex gap-4 text-sm">
          <NavLink to="/browse" className={linkClass}>Browse</NavLink>
          <NavLink to="/profile" className={linkClass}>My profile</NavLink>
          <NavLink to="/inbox" className={linkClass}>Inbox</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-stone-600">
            {user.username} · score {user.score}
          </span>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-stone-300 px-2 py-1 hover:bg-stone-50"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
