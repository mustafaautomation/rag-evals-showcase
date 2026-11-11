import Link from "next/link";

export default function NotFound() {
  return (
    <main id="content" className="page">
      <div className="wrap">
        <h1 className="page-title">Page not found</h1>
        <p>
          <Link href="/">Back to the ten industries</Link>
        </p>
      </div>
    </main>
  );
}
