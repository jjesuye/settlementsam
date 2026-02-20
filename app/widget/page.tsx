/**
 * /widget — Standalone widget page (also embeddable via iframe).
 * Minimal chrome, widget centered, transparent background option.
 */
import { CaseEstimatorWidget } from '@/components/widget/CaseEstimatorWidget';

export const metadata = {
  title: 'Case Value Estimator — Settlement Sam',
};

export default function WidgetPage() {
  return (
    <main
      style={{
        minHeight:      '100vh',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '24px 16px',
        background:     'var(--ss-bg)',
      }}
    >
      <CaseEstimatorWidget funnelHref="/quiz" apiBase="/api" />
    </main>
  );
}
