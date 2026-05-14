/**
 * Compact dropdown filter for the Deposit Race chart scope.
 *
 * `value` is either null (= "All buckets / Main goal") or a bucket id.
 * Renders a native <select> so the picker is fully accessible and
 * keyboard-friendly with zero extra dependencies. Mobile UAs render
 * their own native picker UI which is the desired behavior here.
 */

interface BucketOption {
  id: string;
  name: string;
}

interface SavingRaceFilterProps {
  buckets: BucketOption[];
  value: string | null;
  onChange: (next: string | null) => void;
}

const ALL = '__all__';

export function SavingRaceFilter({ buckets, value, onChange }: SavingRaceFilterProps) {
  return (
    <label className="inline-flex items-center gap-2 font-mono text-[11px] text-ink-muted">
      <span className="sr-only">Filter deposit race scope</span>
      <select
        value={value ?? ALL}
        onChange={event => {
          const next = event.target.value;
          onChange(next === ALL ? null : next);
        }}
        className="rounded-pill bg-well px-2 py-1 font-mono text-xs text-ink shadow-neuPressed focus:outline-none"
      >
        <option value={ALL}>All buckets (main goal)</option>
        {buckets.map(bucket => (
          <option key={bucket.id} value={bucket.id}>{bucket.name}</option>
        ))}
      </select>
    </label>
  );
}
