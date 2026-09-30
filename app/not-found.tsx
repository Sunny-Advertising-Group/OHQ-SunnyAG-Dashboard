import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ padding: 40 }}>
      <h1>Page not found</h1>
      <p className="sub">That page doesn&apos;t exist in the portal.</p>
      <p>
        <Link className="btn gold" href="/">
          Back to the overview
        </Link>
      </p>
    </main>
  );
}
