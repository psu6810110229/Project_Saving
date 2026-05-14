import { appVersion } from './version';

export interface ReleaseNote {
  id: string;
  title: string;
  body: string;
}

export interface ReleaseNotes {
  version: string;
  heading: string;
  intro: string;
  notes: ReleaseNote[];
}

export function currentReleaseNotes(): ReleaseNotes {
  return {
    version: appVersion(),
    heading: 'GO-OUT v0.9.0',
    intro: 'This release makes saving progress easier to understand, plan, and trust.',
    notes: [
      {
        id: 'check-balance-flow',
        title: 'Check Balance is now easier to use',
        body: 'Check Balance now helps compare your app balance with your real money in a clearer flow.',
      },
      {
        id: 'recorded-vs-verified',
        title: 'Recorded Deposits and Verified Balance are clearly separated',
        body: 'Money totals now use clearer labels so it is easier to understand what is planned, recorded, and verified.',
      },
      {
        id: 'saving-plan-core',
        title: 'Saving Plan now tracks expected progress',
        body: 'Saving Plan helps you see where you should be today and how your recorded deposits compare.',
      },
      {
        id: 'saving-plan-advanced',
        title: 'Advanced Increasing Daily formulas are available',
        body: 'Increasing Daily plans now support a maximum daily amount and target-based finish behavior.',
      },
      {
        id: 'dashboard-refinement',
        title: 'Dashboard is cleaner and easier to scan',
        body: 'The dashboard layout and hierarchy were refined to make key insights easier to read.',
      },
      {
        id: 'daily-trend-plan-overlay',
        title: 'Daily Trend now compares Recorded Deposits with Your Plan',
        body: 'Daily Trend now includes a plan reference so expected and recorded progress are easier to compare.',
      },
      {
        id: 'dashboard-graph-simplification',
        title: 'Main dashboard graph view is simplified',
        body: 'Deposit Race is hidden from the main dashboard for now to reduce visual clutter.',
      },
      {
        id: 'what-changed',
        title: 'What changed',
        body: 'Clearer total labels, better dashboard hierarchy, more useful plan insights, and improved Bangkok date handling in charts.',
      },
      {
        id: 'coming-later',
        title: 'Coming later',
        body: 'Pause/Resume plans, bucket corrections and moving money between buckets, a smarter notification system, and Thai language support.',
      },
    ],
  };
}
