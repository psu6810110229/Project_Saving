import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddMoneyForm } from '../components/AddMoneyForm/AddMoneyForm';
import { BucketHeader } from '../components/BucketHeader/BucketHeader';
import { CompleteBucketLock } from '../components/CompleteBucketLock/CompleteBucketLock';
import { ConfirmModal } from '../components/ConfirmModal/ConfirmModal';
import { CreateBucketForm } from '../components/CreateBucketForm/CreateBucketForm';
import { VaultUpdatePreviewModal } from '../components/VaultUpdatePreviewModal/VaultUpdatePreviewModal';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { BucketCategoryIcon } from '../components/BucketCategoryIcon/BucketCategoryIcon';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { Spinner } from '../components/Spinner/Spinner';
import { useAuth } from '../hooks/useAuth';
import { useBucketIntentSettings } from '../hooks/useBucketIntentSettings';
import { useLoadingGate } from '../hooks/useLoadingGate';
import { useRoom } from '../hooks/useRoom';
import { useSharedData } from '../hooks/useSharedData';
import { useSmartDefaultAmount } from '../hooks/useSmartDefaultAmount';
import { useI18n } from '../i18n/useI18n';
import { bucketSaved, hasDuplicateBucketName, shouldAutofillBucketName } from '../lib/buckets';
import { BUCKET_CATEGORY_ORDER } from '../lib/bucketCategories';
import { computeBucketIntent } from '../lib/bucketIntent';
import { cumulativeAmountSeries } from '../lib/dashboardStats';
import { SHOW_ATTACHED_SLIP } from '../lib/flags';
import { haptic } from '../lib/haptics';
import type { BucketCategory } from '../types';

const DEFAULT_BUCKET_CATEGORY = 'flight' as const;

export function AddMoney() {
  const navigate = useNavigate();
  const { copy, formatMoney } = useI18n();
  const { user, profile } = useAuth();
  const { activeRoom } = useRoom();
  const data = useSharedData();
  const { buckets, loading: bucketsLoading, saveBuckets } = data.buckets;
  const { transfers: bucketTransfers } = data.bucketTransfers;
  const { logs, loading: logsLoading, error: logsError, insert } = data.logs;
  const leaderboard = data.leaderboard;
  const { roomGoalTarget } = data.goal;
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
  const [selectedQuickAmount, setSelectedQuickAmount] = useState<number | null>(null);
  const [amountValue, setAmountValue] = useState('');
  const [slip, setSlip] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDeposit, setConfirmingDeposit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [vaultPreview, setVaultPreview] = useState<{
    prevSaved: number;
    newSaved: number;
    target: number;
    depositAmount: number;
    bucketName: string;
    reachedBucket: boolean;
  } | null>(null);
  const [bucketCategory, setBucketCategory] = useState<BucketCategory | null>(DEFAULT_BUCKET_CATEGORY);
  const [bucketName, setBucketName] = useState(() => copy.bucket.defaultNames[DEFAULT_BUCKET_CATEGORY]);
  const [bucketTarget, setBucketTarget] = useState('30000');
  const [appliedBucketId, setAppliedBucketId] = useState<string | null>(null);
  const [smartDefaultActive, setSmartDefaultActive] = useState(false);
  const [doneLockOverridden, setDoneLockOverridden] = useState(false);

  const activeRoomId = activeRoom?.id ?? null;
  const { settings: intentSettings, logIntentEvent } = useBucketIntentSettings(activeRoomId);
  const intentResult = computeBucketIntent({
    buckets,
    logs,
    transfers: bucketTransfers,
    currentUserId: user?.id,
    settings: intentSettings,
  });

  const bucketOptions = BUCKET_CATEGORY_ORDER.map((id) => ({
    id, icon: <BucketCategoryIcon category={id} size={22} />, label: copy.bucket.categoryLabels[id],
  }));

  const selectedBucket = buckets.find(bucket => bucket.id === selectedBucketId) ?? buckets[0];
  const selectedBucketSaved = selectedBucket ? bucketSaved(selectedBucket.id, logs, bucketTransfers) : 0;
  const selectedBucketAlreadyComplete = selectedBucket
    ? selectedBucket.target_amount > 0 && selectedBucketSaved >= selectedBucket.target_amount
    : false;
  const amount = useMemo(() => Number(amountValue) || selectedQuickAmount || 0, [amountValue, selectedQuickAmount]);
  const partner = leaderboard.entries.find(entry => !entry.isYou);
  const smartDefault = useSmartDefaultAmount(user?.id, selectedBucket?.id ?? null, logs);

  const dataLoading = bucketsLoading || logsLoading;
  const { shouldShowLoader: shouldShowSkeleton } = useLoadingGate({
    loading: dataLoading,
    showAfterMs: 120,
    minimumVisibleMs: 400,
  });

  if (dataLoading && shouldShowSkeleton) return <AddMoneySkeleton />;
  if (dataLoading) return null;
  if (logsError) return <StatusCard title={copy.addMoney.loadError} body={logsError} sectionLabel={copy.addMoney.sectionLabel} />;

  function handleBucketCategoryChange(next: BucketCategory) {
    setBucketCategory(next);
    setBucketName(currentName =>
      shouldAutofillBucketName(currentName, copy.bucket.defaultNames)
        ? copy.bucket.defaultNames[next]
        : currentName,
    );
  }

  async function handleCreateBucket() {
    const target = Number(bucketTarget);
    if (!bucketCategory || !bucketName.trim() || target <= 0) {
      setMessage(copy.bucket.validationNameAndTarget);
      return;
    }
    if (hasDuplicateBucketName(buckets, bucketName)) {
      setMessage(copy.bucket.duplicateName(bucketName.trim()));
      return;
    }
    const result = await saveBuckets([
      ...buckets,
      { id: undefined, name: bucketName.trim(), target_amount: target, category: bucketCategory },
    ]);
    if (result.error) {
      setMessage(result.code === 'duplicate_name'
        ? copy.bucket.duplicateName(result.duplicateName ?? bucketName.trim())
        : result.error);
    } else {
      haptic('success');
      setMessage(copy.bucket.createdAddMoney);
      setBucketCategory(DEFAULT_BUCKET_CATEGORY);
      setBucketName(copy.bucket.defaultNames[DEFAULT_BUCKET_CATEGORY]);
      setBucketTarget('');
    }
  }


  function requestConfirmDeposit() {
    if (!selectedBucket || amount <= 0) {
      setMessage(copy.addMoney.validationNoBucket);
      return;
    }
    setMessage(null);
    setConfirmingDeposit(true);
  }

  async function handleConfirmDeposit() {
    if (!selectedBucket || amount <= 0) {
      setMessage(copy.addMoney.validationNoBucket);
      setConfirmingDeposit(false);
      return;
    }
    setSaving(true);
    const slipMarker = SHOW_ATTACHED_SLIP && slip ? `attached:${slip.name}` : null;
    const prevBucketSaved = bucketSaved(selectedBucket.id, logs, bucketTransfers);
    const prevTotalSaved = leaderboard.entries.reduce((sum, entry) => sum + entry.saved, 0);
    const legacySummedTargets = leaderboard.entries.reduce(
      (sum, entry) => sum + (entry.personalGoalTarget ?? 0),
      0,
    );
    const previewTarget = roomGoalTarget ?? (legacySummedTargets > 0 ? legacySummedTargets : 0);
    const result = await insert(amount, selectedBucket.id, undefined, slipMarker);
    setSaving(false);
    setConfirmingDeposit(false);
    if (result.error) setMessage(result.error);
    else {
      const reachedBucket = prevBucketSaved < selectedBucket.target_amount
        && prevBucketSaved + amount >= selectedBucket.target_amount;
      haptic(reachedBucket ? 'milestone' : 'success');
      setVaultPreview({
        prevSaved: prevTotalSaved,
        newSaved: prevTotalSaved + amount,
        target: previewTarget,
        depositAmount: amount,
        bucketName: selectedBucket.name,
        reachedBucket,
      });
      setAmountValue('');
      setSelectedQuickAmount(null);
      setSlip(null);
      setMessage(null);
      setAppliedBucketId(null);
    }
  }

  if (!selectedBucket) {
    return (
      <div className="flex flex-col gap-4 pt-8">
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
          onCategoryChange={handleBucketCategoryChange}
          onNameChange={setBucketName}
          onTargetChange={value => setBucketTarget(value.replace(/[^0-9]/g, ''))}
          onSubmit={handleCreateBucket}
        />
      </div>
    );
  }

  if (appliedBucketId !== selectedBucket.id) {
    setAppliedBucketId(selectedBucket.id);
    setDoneLockOverridden(false);
    if (smartDefault.value != null) {
      setSelectedQuickAmount(null);
      setAmountValue(String(smartDefault.value));
      setSmartDefaultActive(true);
    } else {
      setSmartDefaultActive(false);
    }
  }

  const showAddMoneyDoneLock = selectedBucketAlreadyComplete && !doneLockOverridden;
  const nextBucketForAddMoney = intentResult.nextBucketId
    ? buckets.find(b => b.id === intentResult.nextBucketId)
    : null;

  return (
    <div className="flex flex-col gap-5 pt-8">
      <PageHeader
        eyebrow={copy.addMoney.pageEyebrow}
        title={copy.addMoney.pageTitle}
      />
      {!showAddMoneyDoneLock && (
        <BucketPicker buckets={buckets} selectedId={selectedBucket.id} onSelect={setSelectedBucketId} />
      )}
      {message && <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{message}</p>}
      {showAddMoneyDoneLock ? (
        <div className="flex flex-col gap-6">
          <BucketHeader
            icon={bucketIcon(selectedBucket.category)}
            name={selectedBucket.name}
            saved={selectedBucketSaved}
            target={selectedBucket.target_amount}
          />
          <CompleteBucketLock
            title={copy.addMoney.doneLock.title}
            body={copy.addMoney.doneLock.body(selectedBucket.name, nextBucketForAddMoney?.name ?? null)}
            nextLine={nextBucketForAddMoney ? copy.addMoney.doneLock.nextBucket(nextBucketForAddMoney.name) : null}
            backLabel={copy.common.back}
            addAnywayLabel={copy.addMoney.doneLock.addAnyway}
            onBack={() => navigate('/dashboard')}
            onAddAnyway={() => {
              setDoneLockOverridden(true);
              void logIntentEvent({ eventKey: 'done_lock_overridden', bucketId: selectedBucket.id });
            }}
            primaryAction={
              nextBucketForAddMoney
                ? {
                    label: copy.addMoney.doneLock.useNextBucket,
                    onClick: () => {
                      setSelectedBucketId(nextBucketForAddMoney.id);
                    },
                  }
                : undefined
            }
          />
        </div>
      ) : (
      <AddMoneyForm
        bucketIcon={bucketIcon(selectedBucket.category)}
        bucketName={selectedBucket.name}
        saved={selectedBucketSaved}
        target={selectedBucket.target_amount}
        quickAmounts={[]}
        selectedQuickAmount={null}
        amountValue={amountValue}
        slip={slip}
        onQuickAmountSelect={() => {}}
        onAmountChange={value => {
          setSmartDefaultActive(false);
          setAmountValue(value.replace(/[^0-9]/g, ''));
          setSelectedQuickAmount(null);
        }}
        onSlipChange={setSlip}
        onSubmit={requestConfirmDeposit}
        mineLabel={profile?.display_name ?? copy.dashboard.youLabel}
        theirLabel={partner?.displayName ?? copy.addMoney.partnerLabel}
        mineSeries={cumulativeAmountSeries(logs, user?.id, amount)}
        theirSeries={cumulativeAmountSeries(logs, partner?.userId)}
        submitting={saving}
      />
      )}
      {/* Quick amounts editor hidden for now */}
      <ConfirmModal
        open={confirmingDeposit}
        title={
          selectedBucketAlreadyComplete
            ? copy.addMoney.completeBucketConfirmTitle(selectedBucket.name)
            : copy.addMoney.confirmBannerTitle(formatMoney(amount), selectedBucket.name)
        }
        body={
          selectedBucketAlreadyComplete
            ? copy.addMoney.completeBucketConfirmBody(selectedBucket.name)
            : SHOW_ATTACHED_SLIP && slip
              ? copy.addMoney.confirmBannerBodySlip
              : copy.addMoney.confirmBannerBodyNoSlip
        }
        confirmLabel={
          saving
            ? copy.savingPlan.savingButton
            : selectedBucketAlreadyComplete
              ? copy.addMoney.completeBucketConfirmLabel
              : copy.addMoney.confirmDepositButton
        }
        onCancel={() => {
          if (!saving) setConfirmingDeposit(false);
        }}
        onConfirm={handleConfirmDeposit}
      />
      <VaultUpdatePreviewModal
        open={vaultPreview !== null}
        prevSaved={vaultPreview?.prevSaved ?? 0}
        newSaved={vaultPreview?.newSaved ?? 0}
        target={vaultPreview?.target ?? 0}
        depositAmount={vaultPreview?.depositAmount ?? 0}
        bucketName={vaultPreview?.bucketName ?? ''}
        reachedBucket={vaultPreview?.reachedBucket ?? false}
        cardholderNames={leaderboard.entries.map(e => e.displayName)}
        validThru={activeRoom?.end_date ?? null}
        onDone={() => {
          setVaultPreview(null);
          window.location.assign('/dashboard');
        }}
      />
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
    <div className="flex flex-col gap-5 pt-8" aria-label={copy.addMoney.loadingAriaLabel}>
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
  return <BucketCategoryIcon category={category} size={28} />;
}
