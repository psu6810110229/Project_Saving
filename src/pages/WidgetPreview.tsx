import { SavingsWidget } from '../components/SavingsWidget/SavingsWidget';

/**
 * Dev-only preview route at `/widget`. Renders the 4×2 home-screen widget face
 * on a dark backdrop that simulates an Android home screen, so the styling can
 * be checked against the product mockup. Sibling of `/atoms` · `/molecules`.
 */
export function WidgetPreview() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[#0d0d0f] px-6 py-10">
      <SavingsWidget />
    </div>
  );
}
