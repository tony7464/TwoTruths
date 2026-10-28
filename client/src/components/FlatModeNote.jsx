// Names why the cube is off, and offers the buttons that turn it back on.
import { CONTEXT_LOST_REASON, useCubeFallback } from "../cube/useCubeMode";

const buttonClass = "rounded-md border border-stone-300 bg-white px-3 py-2 text-sm hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]";

export default function FlatModeNote() {
  const fallback = useCubeFallback();
  if (!fallback?.reason) return null;

  return (
    <div className="mb-3 space-y-2">
      <p className="text-sm text-stone-600">{fallback.reason}</p>
      {fallback.offerOptIn ? (
        <button type="button" onClick={fallback.optIntoCube} className={buttonClass}>
          Show 3D cube anyway
        </button>
      ) : null}
      {fallback.canChooseCube ? (
        <button type="button" onClick={fallback.chooseCube} className={buttonClass}>
          Use 3D cube
        </button>
      ) : null}
      {fallback.reason === CONTEXT_LOST_REASON ? (
        <button type="button" onClick={() => window.location.reload()} className={buttonClass}>
          Reload page
        </button>
      ) : null}
    </div>
  );
}
