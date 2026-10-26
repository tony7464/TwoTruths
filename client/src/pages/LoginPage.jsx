import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../useAuth";
import { LoginForm } from "../components/AuthForms";
import FlatModeNote from "../components/FlatModeNote";

export default function LoginPage() {
  const { user, loading } = useAuth();

  if (loading) return <p className="p-8 text-center text-stone-600">Loading...</p>;
  if (user) return <Navigate to="/browse" replace />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-sm">
        <FlatModeNote />
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Two Truths</h1>
          <p className="mt-1 text-sm text-stone-600">Spot the lie. Earn the conversation.</p>
        </div>
        <LoginForm />
        <p className="text-sm text-stone-600">
          New here? <Link to="/signup" className="text-emerald-800 underline">Create an account</Link>
        </p>
        <p className="text-xs text-stone-500">
          Demo users: alex, jordan, sam, riley. Password: password123
        </p>
      </div>
    </main>
  );
}
