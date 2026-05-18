import { useMemo, useState, type ReactNode } from 'react';
import { AddMoneyForm } from '../components/AddMoneyForm/AddMoneyForm';
import { Button } from '../components/Button/Button';
import { ConfirmDepositPanel } from '../components/ConfirmDepositPanel/ConfirmDepositPanel';
import { CreateBucketForm } from '../components/CreateBucketForm/CreateBucketForm';
import { Modal } from '../components/Modal/Modal';
import { OutcomeModal } from '../components/OutcomeModal/OutcomeModal';
import { QuickAmountsEditor } from '../components/QuickAmountsEditor/QuickAmountsEditor';
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
import { useSharedData } from '../hooks/useSharedData';
import { useSmartDefaultAmount } from '../hooks/useSmartDefaultAmount';
import { useI18n } from '../i18n/useI18n';
import { bucketSaved } from '../lib/buckets';
import { cumulativeAmountSeries } from '../lib/dashboardStats';
import { SHOW_ATTACHED_SLIP } from '../lib/flags';
import { haptic } from '../lib/haptics';
import type { BucketCategory } from '../types';

const BUCKET_OPTION_ICONS: { id: BucketCategory; icon: ReactNode }[] = [
  { id: 'flight', icon: <IconPlane size={22} /> },
  { id: 'accom', icon: <IconBed size={22} /> },
  { id: 'dining', icon: <IconFork size={22} /> },
  { id: 'activities', icon: <IconTicket size={22} /> },
  { id: 'gear', icon: <IconSmartphone size={22} /> },
  { id: 'home', icon: <IconHome size={22} /> },
];

export function AddMoney() {
  const { copy, formatMoney } = useI18n();
  const { user, profile } = useAuth();
  const data = useSharedData();
  const { quickAmounts, updateQuickAmounts } = data.profile;
  const { buckets, loading: bucketsLoading, saveBuckets } = data.buckets;
  const { logs, loading: logsLoading, error: logsError, insert } = data.logs;
  const leaderboard = data.leaderboard;
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
  const [editingQuickAmounts, setEditingQuickAmounts] = useState(false);
  const [quickAmountDrafts, setQuickAmountDrafts] = useState<string[]>([]);
  const [appliedBucketId, setAppliedBucketId] = useState<string | null>(null);
  const [smartDefaultActive, setSmartDefaultActive] = useState(false);

  const bucketOptions = BUCKET_OPTION_ICONS.map(({ id, icon }) => ({
    id, icon, label: copy.bucket.categoryLabels[id],
  }));

  const selectedBucket = buckets.find(bucket => bucket.id === selectedBucketId) ?? buckets[0];
  const amount = useMemo(() => Number(amountValue) || selectedQuickAmount || 0, [amountValue, selectedQuickAmount]);
  const partner = leaderboard.entries.find(entry => !entry.isYou);
  const smartDefault = useSmartDefaultAmount(user?.id, selectedBucket?.id ?? null, logs);

  if (bucketsLoading || logsLoading) return <AddMoneySkeleton />;
  if (logsError) return <StatusCard title={copy.addMoney.loadError} body={logsError} sectionLabel={copy.addMoney.sectionLabel} />;

  async function handleCreateBucket() {
    const target = Number(bucketTarget);
    if (!bucketCategory || !bucketName.trim() || target <= 0) {
      setMessage(copy.bucket.validationNameAndTarget);
      return;
    }
    const result = await saveBuckets([
      ...buckets,
      { id: undefined, name: bucketName.trim(), target_amount: target, category: bucketCategory },
    ]);
    if (result.error) setMessage(result.error);
    else {
      haptic('success');
      setMessage(copy.bucket.createdAddMoney);
      setBucketName('');
      setBucketTarget('');
    }
  }

  function openQuickAmountsEditor() {
    setQuickAmountDrafts(quickAmounts.map(String));
    setEditingQuickAmounts(true);
  }

  async function handleQuickAmountsSave() {
    const parsed = quickAmountDrafts
      .map(value => Number(value))
      .filter(value => Number.isFinite(value) && value > 0);
    if (parsed.length === 0) {
      setMessage(copy.addMoney.validationNoBucket);
      return;
    }
    const result = await updateQuickAmounts(parsed);
    if (result.error) setMessage(result.error);
    else {
      setEditingQuickAmounts(false);
      setMessage(copy.manageProject.quickAmountsSuccess);
    }
  }

  async function handleConfirmDeposit() {
    if (!selectedBucket || amount <= 0) {
      setMessage(copy.addMoney.validationNoBucket);
      setReviewing(false);
      return;
    }
    const slipMarker = SHOW_ATTACHED_SLIP && slip ? `attached:${slip.name}` : null;
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
      setAppliedBucketId(null);
    }
  }

  if (!selectedBucket) {
    return (
      <div className="flex flex-col gap-4">
        <StatusCard
          title={copy.addMoney.createFirstTitle}
          body={copy.addMoney.createFirstBody}
          sectionLabel={copy.addMoney.sectionLabel}
        />
        {message && <p className="rounded-lg bg-brand-50 px-4 py-3 font-mono text-xs text-brand-800">{message}</p>}
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

  if (appliedBucketId !== selectedBucket.id) {
    setAppliedBucketId(selectedBucket.id);
    if (smartDefault.value != null) {
      if (quickAmounts.includes(smartDefault.value)) {
        setSelectedQuickAmount(smartDefault.value);
        setAmountValue('');
      } else {
        setSelectedQuickAmount(null);
        setAmountValue(String(smartDefault.value));
      }
      setSmartDefaultActive(true);
    } else {
      setSmartDefaultActive(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={copy.addMoney.pageEyebrow}
        title={copy.addMoney.pageTitle}
        subtitle={copy.addMoney.pageSubtitle}
      />
      <BucketPicker buckets={buckets} selectedId={selectedBucket.id} onSelect={setSelectedBucketId} />
      {message && <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{message}</p>}
      {reviewing ? (
        <ConfirmDepositPanel
          bannerIcon={<IconRocket size={22} />}
          bannerTitle={copy.addMoney.confirmBannerTitle(formatMoney(amount), selectedBucket.name)}
          bannerBody={SHOW_ATTACHED_SLIP ? (slip ? copy.addMoney.confirmBannerBodySlip : copy.addMoney.confirmBannerBodyNoSlip) : undefined}
          mineLabel={profile?.display_name ?? copy.dashboard.youLabel}
          theirLabel={partner?.displayName ?? copy.addMoney.partnerLabel}
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
            if (next !== selectedQuickAmount) setSmartDefaultActive(false);
            setSelectedQuickAmount(next);
            setAmountValue('');
          }}
          onAmountChange={value => {
            setSmartDefaultActive(false);
            setAmountValue(value.replace(/[^0-9]/g, ''));
            setSelectedQuickAmount(null);
          }}
          onSlipChange={setSlip}
          onSubmit={() => setReviewing(true)}
          onEditQuickAmounts={openQuickAmountsEditor}
          smartDefaultHint={smartDefaultActive ? copy.addMoney.smartDefaultHint : null}
        />
      )}
      <Modal
        open={editingQuickAmounts}
        title={copy.manageProject.quickAmountsModalTitle}
        onClose={() => setEditingQuickAmounts(false)}
      >
        <QuickAmountsEditor
          amounts={quickAmountDrafts}
          onChange={setQuickAmountDrafts}
          onSave={handleQuickAmountsSave}
        />
      </Modal>
      <OutcomeModal
        open={created}
        outcome="success"
        icon={<IconCheck size={28} />}
        title={copy.addMoney.outcomeTitle}
        body={copy.addMoney.outcomeBody(selectedBucket.name, formatMoney(lastDepositAmount))}
      >
        <Button variant="action" fullWidth onClick={() => setCreated(false)}>{copy.addMoney.outcomeDone}</Button>
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

function StatusCard({ title, body, sectionLabel }: { title: string; body: string; sectionLabel: string }) {
  return (
    <section className="rounded-xl bg-surface p-5 shadow-soft">
      <SectionLabel tone="brand">{sectionLabel}</SectionLabel>
      <h1 className="mt-2 font-mono text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 font-mono text-xs text-ink-muted">{body}</p>
    </section>
  );
}

function AddMoneySkeleton() {
  const { copy } = useI18n();
  return (
    <div className="flex flex-col gap-5" aria-label={copy.addMoney.loadingAriaLabel}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20 rounded-pill" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-3 w-44 rounded-pill" />
        </div>
        <Spinner size="sm" tone="neutral" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        <Skeleton className="h-9 w-24 rounded-pill" />
        <Skeleton className="h-9 w-28 rounded-pill" />
        <Skeleton className="h-9 w-20 rounded-pill" />
      </div>
      <section className="rounded-xl bg-surface p-5 shadow-soft">
        <Skeleton className="h-5 w-40 rounded-pill" />
        <Skeleton className="mt-4 h-32 rounded-lg" />
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
