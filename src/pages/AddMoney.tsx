import { useMemo, useState, type ReactNode } from 'react';
import { AddMoneyForm } from '../components/AddMoneyForm/AddMoneyForm';
import { Button } from '../components/Button/Button';
import { ConfirmDepositPanel } from '../components/ConfirmDepositPanel/ConfirmDepositPanel';
import { CreateBucketForm } from '../components/CreateBucketForm/CreateBucketForm';
import { OutcomeModal } from '../components/OutcomeModal/OutcomeModal';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import {
  IconBed,
  IconBriefcase,
  IconCheck,
  IconFork,
  IconHome,
  IconPlane,
  IconRocket,
  IconSmartphone,
  IconTicket,
} from '../components/Icon/Icon';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { Spinner } from '../components/Spinner/Spinner';
import { useAuth } from '../hooks/useAuth';
import { useBuckets } from '../hooks/useBuckets';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useLogs } from '../hooks/useLogs';
import { useProfile } from '../hooks/useProfile';
import { useRoom } from '../hooks/useRoom';
import { bucketSaved } from '../lib/buckets';
import { cumulativeAmountSeries } from '../lib/dashboardStats';
import { formatCurrency } from '../lib/format';
import { haptic } from '../lib/haptics';
import type { BucketCategory } from '../types';

export function AddMoney() {
  const { user, profile } = useAuth();
  const { quickAmounts } = useProfile();
  const { activeRoomId } = useRoom();
  const { buckets, loading: bucketsLoading, saveBuckets } = useBuckets(activeRoomId);
  const { logs, loading: logsLoading, error: logsError, insert } = useLogs(100, activeRoomId);
  const leaderboard = useLeaderboard(logs, user?.id, activeRoomId);
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
  const [selectedQuickAmount, setSelectedQuickAmount] = useState<number | null>(500);
  const [amountValue, setAmountValue] = useState('');
  const [slip, setSlip] = useState<File | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [lastDepositAmount, setLastDepositAmount] = useState(0);
  const [bucketCategory, setBucketCategory] = useState<BucketCategory | null>('flight');
  const [bucketName, setBucketName] = useState('Flights');
  const [bucketTarget, setBucketTarget] = useState('30000');

  const selectedBucket = buckets.find(bucket => bucket.id === selectedBucketId) ?? buckets[0];
  const amount = useMemo(() => Number(amountValue) || selectedQuickAmount || 0, [amountValue, selectedQuickAmount]);
  const partner = leaderboard.entries.find(entry => !entry.isYou);

  if (bucketsLoading || logsLoading) return <AddMoneySkeleton />;
  if (logsError) return <StatusCard title="Could not load deposits" body={logsError} />;

  async function handleCreateBucket() {
    const target = Number(bucketTarget);
    if (!bucketCategory || !bucketName.trim() || target <= 0) {
      setMessage('Add a bucket name, target, and category.');
      return;
    }
    const result = await saveBuckets([
      ...buckets,
      { id: undefined, name: bucketName.trim(), target_amount: target, category: bucketCategory },
    ]);
    if (result.error) setMessage(result.error);
    else {
      haptic('success');
      setMessage('Bucket created. Pick an amount when it appears above.');
      setBucketName('');
      setBucketTarget('');
    }
  }

  async function handleConfirmDeposit() {
    if (!selectedBucket || amount <= 0) {
      setMessage('Choose a bucket and enter an amount above zero.');
      setReviewing(false);
      return;
    }
    const slipMarker = slip ? `attached:${slip.name}` : null;
    const prevBucketSaved = bucketSaved(selectedBucket.id, logs);
    const result = await insert(amount, selectedBucket.id, undefined, slipMarker);
    if (result.error) setMessage(result.error);
    else {
      const reachedBucket = prevBucketSaved < selectedBucket.target_amount
        && prevBucketSaved + amount >= selectedBucket.target_amount;
      haptic(reachedBucket ? 'milestone' : 'success');
      setLastDepositAmount(amount);
      setCreated(true);
      setReviewing(false);
      setAmountValue('');
      setSelectedQuickAmount(500);
      setSlip(null);
      setMessage(null);
    }
  }

  if (!selectedBucket) {
    return (
      <div className="flex flex-col gap-4">
        <StatusCard title="Create your first bucket" body="Deposits need a destination before they can be saved." />
        {message && <p className="rounded-2xl bg-brand-50 px-4 py-3 font-mono text-xs text-brand-800">{message}</p>}
        <CreateBucketForm
          category={bucketCategory}
          options={bucketOptions}
          name={bucketName}
          target={bucketTarget}
          onCategoryChange={setBucketCategory}
          onNameChange={setBucketName}
          onTargetChange={value => setBucketTarget(value.replace(/[^0-9]/g, ''))}
          onSubmit={handleCreateBucket}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow="Add Money" title="Deposit to a bucket" subtitle="Manual entry and slip attachment" />
      <BucketPicker buckets={buckets} selectedId={selectedBucket.id} onSelect={setSelectedBucketId} />
      {message && <p className="rounded-2xl bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{message}</p>}
      {reviewing ? (
        <ConfirmDepositPanel
          bannerIcon={<IconRocket size={22} />}
          bannerTitle={`Confirm ${formatCurrency(amount)} for ${selectedBucket.name}`}
          bannerBody={slip ? 'A transfer slip marker will be saved with this log.' : 'No slip attached for this deposit.'}
          mineLabel={profile?.display_name ?? 'You'}
          theirLabel={partner?.displayName ?? 'Partner'}
          mineSeries={cumulativeAmountSeries(logs, user?.id, amount)}
          theirSeries={cumulativeAmountSeries(logs, partner?.userId)}
          onPrimary={handleConfirmDeposit}
          onSecondary={() => setReviewing(false)}
        />
      ) : (
        <AddMoneyForm
          bucketIcon={bucketIcon(selectedBucket.category)}
          bucketName={selectedBucket.name}
          saved={bucketSaved(selectedBucket.id, logs)}
          target={selectedBucket.target_amount}
          quickAmounts={quickAmounts}
          selectedQuickAmount={selectedQuickAmount}
          amountValue={amountValue}
          slip={slip}
          onQuickAmountSelect={next => {
            setSelectedQuickAmount(next);
            setAmountValue('');
          }}
          onAmountChange={value => {
            setAmountValue(value.replace(/[^0-9]/g, ''));
            setSelectedQuickAmount(null);
          }}
          onSlipChange={setSlip}
          onSubmit={() => setReviewing(true)}
        />
      )}
      <OutcomeModal
        open={created}
        outcome="success"
        icon={<IconCheck size={28} />}
        title="Deposit Confirmed"
        body={`${selectedBucket.name} moved by ${formatCurrency(lastDepositAmount)}.`}
      >
        <Button variant="action" fullWidth onClick={() => setCreated(false)}>Done</Button>
      </OutcomeModal>
    </div>
  );
}

function BucketPicker({
  buckets,
  selectedId,
  onSelect,
}: {
  buckets: { id: string; name: string; category?: BucketCategory }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {buckets.map(bucket => (
        <button
          key={bucket.id}
          type="button"
          onClick={() => onSelect(bucket.id)}
          className={`shrink-0 rounded-pill px-4 py-2 font-mono text-xs font-bold transition-colors ${
            bucket.id === selectedId ? 'bg-brand-800 text-ink-inverse' : 'bg-surface text-ink-muted shadow-soft'
          }`}
        >
          {bucket.name}
        </button>
      ))}
    </div>
  );
}

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-3xl bg-surface p-5 shadow-soft">
      <SectionLabel tone="brand">Add Money</SectionLabel>
      <h1 className="mt-2 font-mono text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 font-mono text-xs text-ink-muted">{body}</p>
    </section>
  );
}

function AddMoneySkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-label="Loading deposit flow">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20 rounded-pill" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-3 w-44 rounded-pill" />
        </div>
        <Spinner size="sm" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        <Skeleton className="h-9 w-24 rounded-pill" />
        <Skeleton className="h-9 w-28 rounded-pill" />
        <Skeleton className="h-9 w-20 rounded-pill" />
      </div>
      <section className="rounded-3xl bg-surface p-5 shadow-soft">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-32" />
        <Skeleton className="mt-4 h-12 rounded-pill" />
      </section>
    </div>
  );
}

function bucketIcon(category: BucketCategory | undefined): ReactNode {
  if (category === 'flight' || category === 'travel') return <IconPlane size={28} />;
  if (category === 'accom') return <IconBed size={28} />;
  if (category === 'dining') return <IconFork size={28} />;
  if (category === 'activities' || category === 'transport') return <IconTicket size={28} />;
  if (category === 'gear') return <IconSmartphone size={28} />;
  if (category === 'home') return <IconHome size={28} />;
  return <IconBriefcase size={28} />;
}

const bucketOptions = [
  { id: 'flight' as const, label: 'Flight', icon: <IconPlane size={22} /> },
  { id: 'accom' as const, label: 'Stay', icon: <IconBed size={22} /> },
  { id: 'dining' as const, label: 'Dining', icon: <IconFork size={22} /> },
  { id: 'activities' as const, label: 'Activity', icon: <IconTicket size={22} /> },
  { id: 'gear' as const, label: 'Gear', icon: <IconSmartphone size={22} /> },
  { id: 'home' as const, label: 'Home', icon: <IconHome size={22} /> },
];
