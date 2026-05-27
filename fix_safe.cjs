const fs = require('fs');

let dbContent = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');

// Use exact string replacement for safe variables
const toRemoveExact = [
  "import { BucketDragHint } from '../components/BucketDragHint/BucketDragHint';\n",
  "import { IconEdit, IconSwap } from '../components/Icon/Icon';\n",
  "import { ScrollFadeContainer } from '../components/ScrollFadeContainer/ScrollFadeContainer';\n",
  "  const depositSlipMarker = <span className=\"absolute right-[-2px] top-[-2px] block h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand-500\" />;\n",
  "  type BucketDragMode = 'edit' | 'transfer';\n",
  "  const bucketDragHintDistance = 42; // px drag to trigger hint\n",
  "  const [searchParams, setSearchParams] = useSearchParams();\n",
  "  const bucketReorderSaving = false;\n",
  "  const bucketDragHintMarkedThisSession = false;\n",
  "  const bucketDragHintSeenOnAccount = false;\n",
  "  const hasOtherBuckets = otherMemberBucketGroups.length > 0;\n",
  "  const activeOtherGroup = bucketView === 'mine'\n    ? null\n    : otherMemberBucketGroups.find(group => group.userId === bucketView) ?? null;\n",
  "          onShown={handleBucketDragHintShown}\n",
  "          onDismiss={handleBucketDragHintDismiss}\n",
];

for (const s of toRemoveExact) {
  dbContent = dbContent.replace(s, '');
}

// otherMemberBucketGroups and interface
dbContent = dbContent.replace(/interface OtherMemberBucketGroup \{[\s\S]*?\} \[\];/m, '');
const groupIndex = dbContent.indexOf('  interface OtherMemberBucketGroup {');
if (groupIndex !== -1) {
  const groupEnd = dbContent.indexOf('  const activityItems = useMemo', groupIndex);
  if (groupEnd !== -1) {
    dbContent = dbContent.slice(0, groupIndex) + dbContent.slice(groupEnd);
  }
}

// Button variant
dbContent = dbContent.replace('variant={isEditingBuckets ? "solid" : "secondary"}', 'variant={isEditingBuckets ? "action" : "secondary"}');

fs.writeFileSync('src/pages/Dashboard.tsx', dbContent);
console.log('Safe fix done');
