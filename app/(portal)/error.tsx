"use client";

export default function PortalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="emptybox" style={{ marginTop: 24 }}>
      <b>Something went wrong loading this page</b>
      Try again. If it keeps happening, let your Sunny account team know.
      <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
        <button className="btn gold sm" type="button" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
