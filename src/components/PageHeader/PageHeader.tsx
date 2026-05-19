import { useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { SectionLabel } from '../SectionLabel/SectionLabel';

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /**
   * Whether to render a back arrow. Defaults to false so top-level tab
   * destinations (Dashboard / Add / Profile) don't render a back CTA
   * with nowhere to go. Sub-pages (e.g. ManageProject) opt in by
   * passing `showBack`.
   */
  showBack?: boolean;
}

export function PageHeader({ eyebrow, title, subtitle, showBack = false }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="flex items-start gap-3">
      {showBack && (
        <IconButton ariaLabel="Go back" size="md" onClick={() => navigate(-1)}>
          <IconArrowLeft size={20} />
        </IconButton>
      )}
      <div className="min-w-0 flex-1">
        <SectionLabel tone="brand">{eyebrow}</SectionLabel>
        <h1 className="mt-1 truncate font-mono text-2xl font-bold leading-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 font-mono text-xs text-ink-muted">{subtitle}</p>}
      </div>
    </header>
  );
}
