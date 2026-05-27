const fs = require('fs');

let db = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');

// 1. buildMergedActivity from 3 to 1
db = db.replace(/buildMergedActivity\(([^)]*?),\s*3\s*,/g, "buildMergedActivity($1, 1,");

// 2. Remove unused variables
const toRemove = [
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
];
toRemove.forEach(str => { db = db.replace(str, ''); });
db = db.replace(/import { useSearchParams } from 'react-router-dom';\n/, '');
db = db.replace(/const { data: dataProfile, loading: profileLoading, error: profileError } = useProfile\(\);/, "const { error: profileError } = useProfile();");
db = db.replace(/const roomMembersBucketsByUser = useMemo\([\s\S]*?}, \[data\.roomMembersBuckets\.allBuckets\]\);\n/m, '');
db = db.replace(/const handleBucketDragHintShown =[\s\S]*?};\n/m, '');
db = db.replace(/const handleBucketDragHintDismiss =[\s\S]*?};\n/m, '');
db = db.replace(/const hasOtherBuckets = otherMemberBucketGroups\.length > 0;\n/, '');
db = db.replace(/const activeOtherGroup = bucketView === 'mine'[\s\S]*?\?\? null;\n/m, '');
db = db.replace(/interface OtherMemberBucketGroup \{[\s\S]*?\} \[\];\n/m, '');
db = db.replace(/const otherMemberBucketGroups: OtherMemberBucketGroup\[\] =[\s\S]*?\.filter\(group => group\.items\.length > 0\);\n/m, '');
db = db.replace(/setBucketReorderSaving\(true\);\n/g, '');
db = db.replace(/setBucketReorderSaving\(false\);\n/g, '');
db = db.replace(/setBucketDragHintMarkedThisSession\(true\);\n/g, '');

// remove BucketDragHint component usage
db = db.replace(/<BucketDragHint[\s\S]*?\/>/, '');

// fix variants
db = db.replace(/variant={isEditingBuckets \? "solid" : "secondary"}/g, 'variant={isEditingBuckets ? "action" : "secondary"}');

// Reorder layout
const getBlock = (startRegex, endRegex) => {
  const match = db.match(new RegExp(startRegex + '[\\s\\S]*?' + endRegex));
  return match ? match[0] : null;
};

const actionAlert = getBlock('<motion\\.div variants={dashboardSectionVariants}>\n\\s*<ActionAlert', '</motion\\.div>');
const teamSummary = getBlock('\\{/\\* 2 — Team summary\\. \\*/\\}', '</motion\\.div>');
const savingPlan = getBlock('\\{/\\* 3 — Saving Plan island', '</motion\\.div>');
const nextWin = getBlock('\\{/\\* \\(Next Win', '\\)}');
const smartBuckets = getBlock('\\{/\\* 4 — Smart Buckets\\. \\*/\\}', '</motion\\.div>');
const insights = getBlock('\\{/\\* 5 - Insights\\.', '</motion\\.div>');
const activity = getBlock('\\{/\\* 6 — Activity\\.', '</motion\\.section>');

if (actionAlert && teamSummary && savingPlan && nextWin && smartBuckets && insights && activity) {
  // modify SavingPlan
  const newSavingPlan = savingPlan.replace('onDeposit={handleDepositFromPlan}', 'onDeposit={handleDepositFromPlan}\n          compact');
  // split insights
  const miniTimelineMatch = insights.match(/<MiniTimeline[\s\S]*?\/>/);
  const miniTimeline = miniTimelineMatch ? miniTimelineMatch[0].replace('onOpenTimeline={handleTimelineOpen}', 'onOpenTimeline={handleTimelineOpen}\n          compact') : '';
  const momentumChartBlock = insights.replace(miniTimelineMatch[0], '').replace('className="flex min-h-[21rem] flex-col gap-3" ', '');

  const newLayout = `${newSavingPlan}

      <motion.div variants={dashboardSectionVariants}>
        ${miniTimeline}
      </motion.div>

      ${actionAlert}

      ${nextWin}

      ${smartBuckets}

      ${teamSummary}

      ${momentumChartBlock}

      ${activity}`;

  // Find start and end of layout area
  const layoutStart = db.indexOf('<motion.div variants={dashboardSectionVariants}>\n        <ActionAlert');
  const layoutEnd = db.indexOf('</motion.section>') + '</motion.section>'.length;
  
  if (layoutStart !== -1 && layoutEnd !== -1) {
    db = db.substring(0, layoutStart) + newLayout + db.substring(layoutEnd);
  } else {
    console.log("Failed to find layout boundaries");
  }
} else {
  console.log("Failed to extract one of the layout blocks");
}

fs.writeFileSync('src/pages/Dashboard.tsx', db);
console.log("Reorder and fix complete");
