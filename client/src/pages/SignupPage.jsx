import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../useAuth";
import { SignupForm } from "../components/AuthForms";
import FlatModeNote from "../components/FlatModeNote";

export default function SignupPage() {
  const { user, loading } = useAuth();

  if (loading) return <p className="p-8 text-center text-stone-600">Loading...</p>;
  if (user) return <Navigate to="/browse" replace />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-sm">
        <FlatModeNote />
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Create your profile</h1>
          <p className="mt-1 text-sm text-stone-600">You will add two truths and one lie next.</p>
        </div>
        <SignupForm />
        <p className="text-sm text-stone-600">
          Already have an account? <Link to="/login" className="text-emerald-800 underline">Log in</Link>
        </p>
      </div>
    </main>
  );
}
