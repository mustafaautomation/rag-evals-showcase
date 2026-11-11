import { catalog } from "@/lib/industries";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p data-testid="honesty">{catalog.honesty}</p>
      </div>
    </footer>
  );
}
