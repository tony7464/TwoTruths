// Chooses the 3D cube or the flat pages, and lists the flat routes.
import { lazy, Suspense, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import FlatModeNote from "./components/FlatModeNote";
import NavBar from "./components/NavBar";
import ProfileEditor from "./components/ProfileEditor";
import CubeErrorBoundary from "./cube/CubeErrorBoundary";
import { CubeFallbackContext, STAGE_BACKGROUND, useCubeMode, useDeferredCanvas } from "./cube/useCubeMode";
import BrowsePage from "./pages/BrowsePage";
import InboxPage from "./pages/InboxPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";

const CubeModeApp = lazy(() => import("./cube/CubeModeApp"));

function CubeLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: STAGE_BACKGROUND }}>
      <p className="text-sm text-stone-600">Loading cube...</p>
    </div>
  );
}

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="p-8 text-center text-stone-600">Loading...</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <FlatModeNote />
        <Outlet />
      </main>
    </div>
  );
}

function FlatRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Navigate to="/browse" replace />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/profile" element={<ProfileEditor />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/players" element={<Navigate to="/browse" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ModeSwitch() {
  const { loading } = useAuth();
  const [loadError, setLoadError] = useState("");
  const cube = useCubeMode(Boolean(loadError), loadError);
  const canvasMounted = useDeferredCanvas(cube.mode === "cube");

  if (loading) {
    return <p className="p-8 text-center text-stone-600">Loading...</p>;
  }

  return (
    <CubeFallbackContext.Provider value={cube}>
      {canvasMounted ? (
        <CubeErrorBoundary onError={(error) => setLoadError(error?.message || "unknown error")}>
          <Suspense fallback={<CubeLoading />}>
            <CubeModeApp />
          </Suspense>
        </CubeErrorBoundary>
      ) : (
        <FlatRoutes />
      )}
    </CubeFallbackContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ModeSwitch />
      </AuthProvider>
    </BrowserRouter>
  );
}
