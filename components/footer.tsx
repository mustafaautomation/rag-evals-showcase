import { catalog } from "@/lib/industries";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p>{catalog.honesty}</p>
        <p>
          Offline numbers are copied from the committed reports. Faithfulness, answer relevancy, context
          precision, and context recall need an API key and are not measured here. MIT license.
        </p>
      </div>
    </footer>
  );
}
