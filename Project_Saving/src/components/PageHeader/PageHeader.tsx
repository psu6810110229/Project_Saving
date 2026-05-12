import { useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { SectionLabel } from '../SectionLabel/SectionLabel';

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  showBack?: boolean;
}

export function PageHeader({ eyebrow, title, subtitle, showBack = true }: PageHeaderProps) {
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
        <h1 className="mt-1 truncate font-mono text-3xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 font-mono text-xs text-ink-muted">{subtitle}</p>}
      </div>
    </header>
  );
}
