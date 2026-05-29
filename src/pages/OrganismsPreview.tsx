import { useState, type ReactNode } from 'react';
import type { ThemeSwatch } from '../lib/theme';
import type { BucketCategory, ProjectCategory } from '../types';
import { ActivityFeed } from '../components/ActivityFeed/ActivityFeed';
import { AddMoneyForm } from '../components/AddMoneyForm/AddMoneyForm';
import { AppShell } from '../components/AppShell/AppShell';
import type { BottomNavTab } from '../components/BottomNav/BottomNav';
import { BucketGrid } from '../components/BucketGrid/BucketGrid';
import { Button } from '../components/Button/Button';
import { ConfirmDepositPanel } from '../components/ConfirmDepositPanel/ConfirmDepositPanel';
import { CreateBucketForm } from '../components/CreateBucketForm/CreateBucketForm';
import { CreateProjectForm } from '../components/CreateProjectForm/CreateProjectForm';
import { DashboardHero } from '../components/DashboardHero/DashboardHero';
import { JoinProjectFlow } from '../components/JoinProjectFlow/JoinProjectFlow';
import { OutcomeModal } from '../components/OutcomeModal/OutcomeModal';
import { ProfileHeader } from '../components/ProfileHeader/ProfileHeader';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { SettingsList } from '../components/SettingsList/SettingsList';
import {
  IconBed,
  IconBell,
  IconBriefcase,
  IconCalendar,
  IconCheck,
  IconEdit,
  IconFork,
  IconGear,
  IconHeart,
  IconHome,
  IconPalette,
  IconPlane,
  IconQrCode,
  IconRocket,
  IconSmartphone,
  IconTicket,
  IconTrash,
} from '../components/Icon/Icon';
import { BucketCategoryIcon } from '../components/BucketCategoryIcon/BucketCategoryIcon';
import { BUCKET_CATEGORY_ORDER } from '../lib/bucketCategories';

export function OrganismsPreview() {
  const [nav, setNav] = useState<BottomNavTab>('dashboard');
  const [quickAmount, setQuickAmount] = useState<number | null>(500);
  const [customAmount, setCustomAmount] = useState('1200');
  const [slip, setSlip] = useState<File | null>(null);
  const [projectCat, setProjectCat] = useState<ProjectCategory | null>('travel');
  const [bucketCat, setBucketCat] = useState<BucketCategory | null>('flight');
  const [projectName, setProjectName] = useState('Japan 2027');
  const [projectTarget, setProjectTarget] = useState('100000');
  const [endDate, setEndDate] = useState('2027-11-01');
  const [bucketName, setBucketName] = useState('Flights');
  const [bucketTarget, setBucketTarget] = useState('30000');
  const [code, setCode] = useState('JP82XC');
  const [modalOpen, setModalOpen] = useState(false);
  const [theme] = useState<ThemeSwatch>('terracotta');
  const [now] = useState(() => Date.now());
  const validCode = code.length >= 6;

  return (
    <AppShell activeTab={nav} onTabChange={setNav}>
      <div className="flex flex-col gap-10">
        <header className="text-center">
          <SectionLabel tone="brand">GO-OUT · Step 7</SectionLabel>
          <h1 className="font-mono text-3xl font-bold mt-2 text-ink">Organisms Preview</h1>
          <p className="font-mono text-xs text-ink-muted mt-2">Composed from Step 6 molecules.</p>
        </header>

        <Group title="DashboardHero">
          <DashboardHero
            title="Japan 2027"
            subtitle="Phan and Art · November 2027"
            leftPlayer={{ name: 'Phan', fallback: 'P', saved: 4200, target: 50000, themeColor: 'terracotta' }}
            rightPlayer={{ name: 'Art', fallback: 'A', saved: 3100, target: 50000, themeColor: 'teal' }}
            saved={80000}
            target={100000}
            momentumSeries={[120, 0, 350, 200, 80, 0, 500]}
            momentumLabels={['M', 'T', 'W', 'T', 'F', 'S', 'S']}
            microGoal={{ icon: <IconRocket size={26} />, title: 'Kyoto Deposit', remaining: 2400, pct: 68, subtitle: 'day 18 of 30' }}
          />
        </Group>

        <Group title="BucketGrid">
          <BucketGrid
            title="Trip Buckets"
            subtitle="Tap a bucket to open its detail flow."
            buckets={bucketItems}
            onAddBucket={() => setNav('team')}
          />
        </Group>

        <Group title="AddMoneyForm">
          <AddMoneyForm
            bucketIcon={<IconPlane size={28} />}
            bucketName="Flights"
            saved={18500}
            target={30000}
            quickAmounts={[50, 150, 500, 1000]}
            selectedQuickAmount={quickAmount}
            amountValue={customAmount}
            slip={slip}
            onQuickAmountSelect={setQuickAmount}
            onAmountChange={value => setCustomAmount(value.replace(/[^0-9]/g, ''))}
            onSlipChange={setSlip}
            onSubmit={() => setModalOpen(true)}
          />
        </Group>

        <Group title="ConfirmDepositPanel">
          <ConfirmDepositPanel
            bannerIcon={<IconRocket size={22} />}
            bannerTitle="You're only ฿800 away from overtaking Art!"
            bannerBody="Add a little more this week to take the lead."
            mineLabel="Phan"
            theirLabel="Art"
            mineSeries={[1200, 1500, 2000, 2200, 2800, 3500, 4200]}
            theirSeries={[1500, 1700, 1800, 2400, 2700, 2900, 3100]}
            onPrimary={() => setModalOpen(true)}
            onSecondary={() => setNav('team')}
          />
        </Group>

        <Group title="CreateProjectForm">
          <CreateProjectForm
            category={projectCat}
            options={projectOptions}
            name={projectName}
            target={projectTarget}
            endDate={endDate}
            onCategoryChange={setProjectCat}
            onNameChange={setProjectName}
            onTargetChange={value => setProjectTarget(value.replace(/[^0-9]/g, ''))}
            onEndDateChange={setEndDate}
            onSubmit={() => setModalOpen(true)}
          />
        </Group>

        <Group title="CreateBucketForm">
          <CreateBucketForm
            category={bucketCat}
            options={bucketOptions}
            name={bucketName}
            target={bucketTarget}
            onCategoryChange={setBucketCat}
            onNameChange={setBucketName}
            onTargetChange={value => setBucketTarget(value.replace(/[^0-9]/g, ''))}
            onSubmit={() => setModalOpen(true)}
            roomEndDate="2027-06-15"
          />
        </Group>

        <Group title="JoinProjectFlow">
          <JoinProjectFlow
            code={code}
            onCodeChange={setCode}
            error={code && !validCode ? 'Enter the full 6-character code.' : undefined}
            preview={validCode ? joinPreview : null}
            onJoin={() => setModalOpen(true)}
          />
        </Group>

        <Group title="OutcomeModal">
          <Button variant="primary" fullWidth onClick={() => setModalOpen(true)}>Open Outcome Modal</Button>
        </Group>

        <Group title="ProfileHeader">
          <ProfileHeader
            name="Phan"
            fallback="P"
            memberLabel="Japan 2027 member"
            themeColor={theme}
            onEdit={() => setNav('profile')}
          />
        </Group>

        <Group title="ActivityFeed">
          <ActivityFeed items={activityItems(now)} />
        </Group>

        <Group title="SettingsList">
          <SettingsList items={settingsItems} archiveItem={archiveItem} />
        </Group>

        <p className="text-center text-xs font-mono text-ink-muted py-4">
          AppShell wraps this page, and BottomNav stays fixed at the bottom.
        </p>
      </div>
      <OutcomeModal
        open={modalOpen}
        outcome="success"
        icon={<IconCheck size={28} />}
        title="Deposit Confirmed"
        body="Flights moved closer to takeoff."
      >
        <Button variant="action" fullWidth onClick={() => setModalOpen(false)}>Done</Button>
      </OutcomeModal>
    </AppShell>
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

const bucketItems = [
  { id: 'flights', icon: <IconPlane size={20} />, name: 'Flights', saved: 18500, target: 30000 },
  { id: 'stay', icon: <IconBed size={20} />, name: 'Accommodation', saved: 12200, target: 25000 },
  { id: 'food', icon: <IconFork size={20} />, name: 'Dining', saved: 4800, target: 10000 },
  { id: 'fun', icon: <IconTicket size={20} />, name: 'Activities', saved: 1500, target: 8000 },
];

const projectOptions = [
  { id: 'travel' as const, label: 'Travel', icon: <IconPlane size={28} /> },
  { id: 'gadget' as const, label: 'Gadget', icon: <IconSmartphone size={28} /> },
  { id: 'wedding' as const, label: 'Wedding', icon: <IconHeart size={28} /> },
  { id: 'home' as const, label: 'Home', icon: <IconHome size={28} /> },
  { id: 'other' as const, label: 'Other', icon: <IconBriefcase size={28} /> },
];

const bucketOptions = BUCKET_CATEGORY_ORDER.map((id) => ({
  id,
  label: id.charAt(0).toUpperCase() + id.slice(1),
  icon: <BucketCategoryIcon category={id} size={22} />,
}));

const joinPreview = {
  roomId: 'preview-room',
  name: 'Japan 2027',
  category: 'travel' as const,
  targetAmount: 100000,
  endDate: '2027-11-01',
  coverImageUrl: null,
  memberCount: 2,
  creatorName: 'Art',
  creatorAvatarUrl: null,
  status: 'found' as const,
};

function activityItems(now: number) {
  return [
    { id: 'recent', actorName: 'Phan', actorFallback: 'P', bucketName: 'Flights', amount: 500, occurredAt: new Date(now - 4 * 60_000).toISOString(), hasSlip: true },
    { id: 'earlier', actorName: 'Art', actorFallback: 'A', bucketName: 'Accommodation', amount: 1200, occurredAt: new Date(now - 2 * 3600_000).toISOString() },
    { id: 'yesterday', actorName: 'Phan', actorFallback: 'P', bucketName: 'Dining', amount: 150, occurredAt: new Date(now - 26 * 3600_000).toISOString(), hasSlip: true },
  ];
}

const settingsItems = [
  { id: 'profile', icon: <IconEdit size={18} />, label: 'Edit Profile', description: 'Display name + avatar' },
  { id: 'alerts', icon: <IconBell size={18} />, label: 'Notifications', meta: <span className="font-mono text-xs text-ink-muted">On</span> },
  { id: 'theme', icon: <IconPalette size={18} />, label: 'Theme Colors', description: 'Personal swatch shown to Art' },
  { id: 'invite', icon: <IconQrCode size={18} />, label: 'Project Invite Code', meta: <span className="font-mono text-xs text-brand-800">JP82XC</span> },
  { id: 'buckets', icon: <IconGear size={18} />, label: 'Manage Buckets' },
  { id: 'date', icon: <IconCalendar size={18} />, label: 'Trip Date', description: 'November 2027' },
];

const archiveItem = {
  id: 'archive',
  icon: <IconTrash size={18} />,
  label: 'Archive Project',
  description: 'Hide from Vault. Cannot be undone.',
};
