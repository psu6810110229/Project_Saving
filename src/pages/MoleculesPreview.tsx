import { useState, type ReactNode } from 'react';
import type { ThemeSwatch } from '../lib/theme';
import type { BucketCategory, ProjectCategory } from '../types';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { Button } from '../components/Button/Button';
import { TextInput } from '../components/TextInput/TextInput';
import { HeadToHeadCard } from '../components/HeadToHeadCard/HeadToHeadCard';
import { TotalVaultCard } from '../components/TotalVaultCard/TotalVaultCard';
import { MomentumChart } from '../components/MomentumChart/MomentumChart';
import { MicroGoalCard } from '../components/MicroGoalCard/MicroGoalCard';
import { BucketRow } from '../components/BucketRow/BucketRow';
import { BucketHeader } from '../components/BucketHeader/BucketHeader';
import { QuickAddRow } from '../components/QuickAddRow/QuickAddRow';
import { ProjectedProgressCard } from '../components/ProjectedProgressCard/ProjectedProgressCard';
import { SlipAttachField } from '../components/SlipAttachField/SlipAttachField';
import { MicroCopyBanner } from '../components/MicroCopyBanner/MicroCopyBanner';
import { ComparisonTrendChart } from '../components/ComparisonTrendChart/ComparisonTrendChart';
import { CategoryRow } from '../components/CategoryRow/CategoryRow';
import { FormField } from '../components/FormField/FormField';
import { OtpField } from '../components/OtpField/OtpField';
import { ProjectPreviewCard } from '../components/ProjectPreviewCard/ProjectPreviewCard';
import { OutcomeModalBody } from '../components/OutcomeModalBody/OutcomeModalBody';
import { ActivityTimelineRow } from '../components/ActivityTimelineRow/ActivityTimelineRow';
import { ThemeSwatchPicker } from '../components/ThemeSwatchPicker/ThemeSwatchPicker';
import { SettingsRow } from '../components/SettingsRow/SettingsRow';
import {
  IconPlane,
  IconBed,
  IconFork,
  IconTicket,
  IconHome,
  IconBriefcase,
  IconSmartphone,
  IconHeart,
  IconPiggyBank,
  IconRocket,
  IconPalette,
  IconBell,
  IconGear,
  IconEdit,
  IconCalendar,
  IconCheck,
  IconX,
  IconTrash,
  IconQrCode,
} from '../components/Icon/Icon';

/**
 * Dev-only preview route at `/molecules`. Renders every molecule shipped
 * in Step 6 against the warm canvas, with realistic sample data drawn
 * from the mockups (Phan vs Art / Japan trip / Smart Buckets).
 *
 * Unauthenticated — open `/molecules` directly. Sibling of `/atoms`.
 */
export function MoleculesPreview() {
  const [pickedAmount, setPickedAmount] = useState<number | null>(150);
  const [slip, setSlip] = useState<File | null>(null);
  const [projectCat, setProjectCat] = useState<ProjectCategory | null>('travel');
  const [bucketCat, setBucketCat] = useState<BucketCategory | null>('flight');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [code, setCode] = useState('JP82');
  const [codeErr, setCodeErr] = useState('');
  const [theme, setTheme] = useState<ThemeSwatch>('terracotta');
  // Snapshot once on mount so re-renders don't shift the relative-time labels.
  const [now] = useState(() => Date.now());
  const recent = new Date(now - 4 * 60_000).toISOString();
  const earlier = new Date(now - 2 * 3600_000).toISOString();
  const yesterday = new Date(now - 26 * 3600_000).toISOString();

  return (
    <div className="min-h-[100dvh] py-8 px-4">
      <div className="max-w-md mx-auto flex flex-col gap-10">
        <header className="text-center">
          <SectionLabel tone="brand">GO-OUT · Step 6</SectionLabel>
          <h1 className="font-mono text-3xl font-bold mt-2 text-ink">Molecules Preview</h1>
          <p className="font-mono text-xs text-ink-muted mt-2">
            Mobile-first ({'<'} 375px base). Open `/molecules` in dev.
          </p>
        </header>

        <Group title="Dashboard · Head-to-Head">
          <HeadToHeadCard
            left={{ name: 'Phan', fallback: 'P', saved: 4200, target: 50000, themeColor: 'terracotta' }}
            right={{ name: 'Art', fallback: 'A', saved: 3100, target: 50000, themeColor: 'teal' }}
          />
        </Group>

        <Group title="Dashboard · Recorded Vault">
          <TotalVaultCard saved={80000} target={100000} trendPct={12} />
        </Group>

        <Group title="Dashboard · 7-day Momentum">
          <MomentumChart
            series={[120, 0, 350, 200, 80, 0, 500]}
            labels={['M', 'T', 'W', 'T', 'F', 'S', 'S']}
          />
        </Group>

        <Group title="Dashboard · Next Win">
          <MicroGoalCard
            icon={<IconRocket size={26} />}
            title="Kyoto Deposit"
            remaining={2400}
            pct={68}
            subtitle="day 18 of 30"
          />
        </Group>

        <Group title="Dashboard · Smart Bucket rows">
          <div className="flex flex-col gap-2">
            <BucketRow icon={<IconPlane size={20} />} name="Flights" saved={18500} target={30000} />
            <BucketRow icon={<IconBed size={20} />} name="Accommodation" saved={12200} target={25000} />
            <BucketRow icon={<IconFork size={20} />} name="Dining" saved={4800} target={10000} />
            <BucketRow icon={<IconTicket size={20} />} name="Activities" saved={1500} target={8000} />
          </div>
        </Group>

        <Group title="Add Money · Bucket header">
          <BucketHeader icon={<IconPlane size={28} />} name="Flights" saved={18500} target={30000} />
        </Group>

        <Group title="Add Money · Quick-add">
          <QuickAddRow
            label="Deposit Amount"
            amounts={[50, 150, 500, 1000]}
            selected={pickedAmount}
            onSelect={setPickedAmount}
          />
        </Group>

        <Group title="Add Money · Projected progress">
          <ProjectedProgressCard
            bucketName="Flights"
            saved={18500}
            target={30000}
            pendingDeposit={pickedAmount ?? 0}
          />
        </Group>

        <Group title="Add Money · Slip attach">
          <SlipAttachField file={slip} onChange={setSlip} />
        </Group>

        <Group title="Confirm Deposit · Micro-copy">
          <div className="flex flex-col gap-3">
            <MicroCopyBanner
              tone="cheer"
              icon={<IconRocket size={22} />}
              title="You're only ฿800 away from overtaking Art!"
              body="Add ฿800 more this week to take the lead."
            />
            <MicroCopyBanner
              tone="nudge"
              icon={<IconHeart size={22} />}
              title="Art is ahead by ฿1,100 — catch up?"
            />
            <MicroCopyBanner
              tone="streak"
              icon={<IconCheck size={22} />}
              title="3-day deposit streak. Keep it warm."
            />
          </div>
        </Group>

        <Group title="Confirm Deposit · Trend vs opponent">
          <ComparisonTrendChart
            mineLabel="You"
            theirLabel="Art"
            mineSeries={[1200, 1500, 2000, 2200, 2800, 3500, 4200]}
            theirSeries={[1500, 1700, 1800, 2400, 2700, 2900, 3100]}
          />
        </Group>

        <Group title="Create Project · Category row">
          <CategoryRow
            label="Project Type"
            shape="square"
            value={projectCat}
            onChange={setProjectCat}
            options={[
              { id: 'travel',  label: 'Travel',  icon: <IconPlane size={28} /> },
              { id: 'gadget',  label: 'Gadget',  icon: <IconSmartphone size={28} /> },
              { id: 'wedding', label: 'Wedding', icon: <IconHeart size={28} /> },
              { id: 'home',    label: 'Home',    icon: <IconHome size={28} /> },
              { id: 'other',   label: 'Other',   icon: <IconBriefcase size={28} /> },
            ]}
          />
        </Group>

        <Group title="Create Bucket · Category row (circle)">
          <CategoryRow
            label="Bucket Category"
            shape="circle"
            value={bucketCat}
            onChange={setBucketCat}
            options={[
              { id: 'flight',     label: 'Flight',   icon: <IconPlane size={22} /> },
              { id: 'accom',      label: 'Stay',     icon: <IconBed size={22} /> },
              { id: 'dining',     label: 'Dining',   icon: <IconFork size={22} /> },
              { id: 'activities', label: 'Activity', icon: <IconTicket size={22} /> },
              { id: 'gear',       label: 'Gear',     icon: <IconSmartphone size={22} /> },
              { id: 'home',       label: 'Home',     icon: <IconHome size={22} /> },
            ]}
          />
        </Group>

        <Group title="Form · Field wrapper">
          <div className="flex flex-col gap-4">
            <FormField label="Project Name" helper="Visible to both members.">
              <TextInput
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Japan 2027"
                leadingIcon={<IconEdit size={16} />}
              />
            </FormField>
            <FormField label="Target Amount" error={target && Number(target) < 100 ? 'Min ฿100' : undefined}>
              <TextInput
                value={target}
                onChange={e => setTarget(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="100000"
                inputMode="numeric"
                leadingIcon={<span className="font-mono text-brand-500 text-sm">฿</span>}
                error={Boolean(target && Number(target) < 100)}
              />
            </FormField>
            <FormField label="End Date">
              <TextInput
                placeholder="2027-11-01"
                leadingIcon={<IconCalendar size={16} />}
              />
            </FormField>
          </div>
        </Group>

        <Group title="Join Project · OTP field + preview">
          <div className="flex flex-col gap-4">
            <OtpField
              value={code}
              onChange={v => { setCode(v); setCodeErr(''); }}
              error={codeErr || undefined}
            />
            <div className="flex justify-center gap-2">
              <Button variant="ghost" size="md" onClick={() => setCodeErr('That code looks expired.')}>
                Mark expired
              </Button>
              <Button variant="ghost" size="md" onClick={() => setCodeErr('Invalid code.')}>
                Mark invalid
              </Button>
              <Button variant="ghost" size="md" onClick={() => setCodeErr('')}>Clear</Button>
            </div>
            <ProjectPreviewCard
              icon={<IconPlane size={32} />}
              name="Japan 2027"
              creatorName="Art"
              creatorFallback="A"
              memberCount={2}
            />
          </div>
        </Group>

        <Group title="Outcome modal bodies">
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-xl bg-surface shadow-soft">
              <OutcomeModalBody
                outcome="success"
                icon={<IconCheck size={28} />}
                title="Welcome to Japan 2027!"
                body="You just joined Art's project. Time to deposit."
              >
                <Button variant="action" fullWidth>Open Dashboard</Button>
              </OutcomeModalBody>
            </div>
            <div className="rounded-xl bg-surface shadow-soft">
              <OutcomeModalBody
                outcome="fail"
                icon={<IconX size={28} />}
                title="Invalid Join Code"
                body="Double-check the code with the project creator."
              >
                <Button variant="primary" fullWidth>Try Again</Button>
              </OutcomeModalBody>
            </div>
            <div className="rounded-xl bg-surface shadow-soft">
              <OutcomeModalBody
                outcome="expired"
                icon={<IconCalendar size={28} />}
                title="Link Expired"
                body="Ask Art to share a fresh code."
              >
                <Button variant="ghost" fullWidth>Go Back</Button>
              </OutcomeModalBody>
            </div>
          </div>
        </Group>

        <Group title="Profile · Activity timeline">
          <div className="rounded-xl bg-surface shadow-soft px-4 divide-y divide-well">
            <ActivityTimelineRow
              actorName="Phan"
              actorFallback="P"
              bucketName="Flights"
              amount={500}
              occurredAt={recent}
              hasSlip
            />
            <ActivityTimelineRow
              actorName="Art"
              actorFallback="A"
              bucketName="Accommodation"
              amount={1200}
              occurredAt={earlier}
            />
            <ActivityTimelineRow
              actorName="Phan"
              actorFallback="P"
              bucketName="Dining"
              amount={150}
              occurredAt={yesterday}
              hasSlip
            />
          </div>
        </Group>

        <Group title="Profile · Theme swatches">
          <ThemeSwatchPicker value={theme} onChange={setTheme} />
          <p className="mt-3 font-mono text-xs text-ink-muted">Selected: <span className="text-brand-800 font-bold">{theme}</span></p>
        </Group>

        <Group title="Settings rows">
          <div className="flex flex-col gap-2">
            <SettingsRow
              icon={<IconEdit size={18} />}
              label="Edit Profile"
              description="Display name + avatar"
              onClick={() => undefined}
            />
            <SettingsRow
              icon={<IconBell size={18} />}
              label="Notifications"
              meta={<span className="font-mono text-xs text-ink-muted">On</span>}
              onClick={() => undefined}
            />
            <SettingsRow
              icon={<IconPalette size={18} />}
              label="Theme Colors"
              description="Personal swatch shown to Art"
              onClick={() => undefined}
            />
            <SettingsRow
              icon={<IconQrCode size={18} />}
              label="Project Invite Code"
              meta={<span className="font-mono text-xs text-brand-800">JP82XC</span>}
              onClick={() => undefined}
            />
            <SettingsRow
              icon={<IconGear size={18} />}
              label="Manage Buckets"
              onClick={() => undefined}
            />
            <SettingsRow
              icon={<IconTrash size={18} />}
              label="Archive Project"
              description="Hide from Vault. Cannot be undone."
              tone="danger"
              onClick={() => undefined}
            />
          </div>
        </Group>

        <p className="text-center text-xs font-mono text-ink-muted py-4">
          That's all 20 molecules. <span className="text-brand-800">Step 7 builds organisms next.</span>
        </p>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-brand-800 mb-3">{title}</h2>
      {children}
    </section>
  );
}

// Silence unused-import noise from IconPiggyBank (kept for future molecule samples).
void IconPiggyBank;
