import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { useI18n } from '../i18n/useI18n';

export function NotFound() {
  const navigate = useNavigate();
  const { copy } = useI18n();

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6">
      <section className="w-full max-w-sm rounded-xl bg-surface p-6 text-center shadow-soft">
        <SectionLabel tone="brand" className="text-center">GO-OUT</SectionLabel>
        <h1 className="mt-3 font-mono text-2xl font-bold text-ink">{copy.notFound.title}</h1>
        <p className="mt-2 font-mono text-xs leading-5 text-ink-muted">{copy.notFound.body}</p>
        <Button className="mt-5" variant="action" fullWidth onClick={() => navigate('/dashboard', { replace: true })}>
          {copy.notFound.cta}
        </Button>
      </section>
    </div>
  );
}
