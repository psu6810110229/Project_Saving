const fs = require('fs');

let db = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');

// 1. buildMergedActivity from 3 to 1
db = db.replace(/buildMergedActivity\(([^)]*?),\s*3\s*,/g, "buildMergedActivity($1, 1,");

// 2. Remove deposit-related state and UI logic
db = db.replace(/const \[heroDepositOpen, setHeroDepositOpen\] = useState\(false\);\n/, '');
db = db.replace(/const \[heroDepositInitialBucketId, setHeroDepositInitialBucketId\] = useState<string \| null>\(null\);\n/, '');
db = db.replace(/const heroDepositBuckets = useMemo\([\s\S]*?}, \[buckets\]\);\n/, '');
db = db.replace(/const quickAmounts = useMemo\([\s\S]*?}, \[target\]\);\n/, '');
db = db.replace(/const handleHeroDepositOpenChange = useCallback\([\s\S]*?}, \[\]\);\n/, '');
db = db.replace(/const handleHeroDepositConfirm = useCallback\([\s\S]*?}, \[handleBucketDeposit\]\);\n/, '');

// Remove deposit props from HeroCard
db = db.replace(/          depositOpen=\{heroDepositOpen\}\n/g, '');
db = db.replace(/          onDepositOpenChange=\{handleHeroDepositOpenChange\}\n/g, '');
db = db.replace(/          depositInitialBucketId=\{heroDepositInitialBucketId\}\n/g, '');
db = db.replace(/          depositBuckets=\{heroDepositBuckets\}\n/g, '');
db = db.replace(/          quickAmounts=\{quickAmounts\}\n/g, '');
db = db.replace(/          onConfirmDeposit=\{handleHeroDepositConfirm\}\n/g, '');

// 3. Replace bucketDragMode with isEditingBuckets
db = db.replace(/type BucketDragMode = 'edit' | 'transfer';\n/, '');
db = db.replace(/const \[bucketDragMode, setBucketDragMode\] = useState<BucketDragMode>\('transfer'\);\n/, 'const [isEditingBuckets, setIsEditingBuckets] = useState(false);\n');
db = db.replace(/mode=\{bucketDragMode\}/g, 'mode={isEditingBuckets ? "edit" : undefined}');
db = db.replace(/<button\s+onClick=\{\(\) => setBucketDragMode\([\s\S]*?<\/button>/, `<Button
                    variant={isEditingBuckets ? "action" : "secondary"}
                    size="sm"
                    onClick={() => setIsEditingBuckets(prev => !prev)}
                  >
                    {isEditingBuckets ? copy.common.done : "Edit"}
                  </Button>`);

// simplify bucket header: remove segmented control for edit/transfer
db = db.replace(/<div className="flex shrink-0 items-center gap-1 rounded-pill bg-surfaceAlt p-1 shadow-neuPressed">[\s\S]*?<\/div>/, `<Button
                    variant={isEditingBuckets ? "action" : "secondary"}
                    size="sm"
                    onClick={() => setIsEditingBuckets(prev => !prev)}
                  >
                    {isEditingBuckets ? copy.common.done : "Edit"}
                  </Button>`);

// Remove bucket drag hint
db = db.replace(/import \{ BucketDragHint \} from '\.\.\/components\/BucketDragHint\/BucketDragHint';\n/, '');
db = db.replace(/const bucketDragHintDistance = 42; \/\/ px drag to trigger hint\n/, '');
db = db.replace(/const \[bucketDragHintSeenOnAccount, setBucketDragHintSeenOnAccount\] = useState\(false\);\n/, '');
db = db.replace(/const \[bucketDragHintMarkedThisSession, setBucketDragHintMarkedThisSession\] = useState\(false\);\n/, '');
db = db.replace(/const handleBucketDragHintShown =[\s\S]*?};\n/, '');
db = db.replace(/const handleBucketDragHintDismiss =[\s\S]*?};\n/, '');
db = db.replace(/<BucketDragHint[\s\S]*?\/>/g, '');

// Removing navigation from HeadToHeadCard and TeamSection
db = db.replace(/          onMemberClick=\{handleTeamMemberClick\}\n/g, '');

// 4. Reorder layout
const getBlock = (startRegex, endRegex) => {
  const match = db.match(new RegExp(startRegex + '[\\s\\S]*?' + endRegex));
  return match ? match[0] : null;
};

const actionAlert = getBlock('<motion\\.div variants=\\{dashboardSectionVariants\\}>\n\\s*<ActionAlert', '</motion\\.div>');
const teamSummary = getBlock('\\{/\\* 2 — Team summary\\. \\*/\\}', '</motion\\.div>');
const savingPlan = getBlock('\\{/\\* 3 — Saving Plan island', '</motion\\.div>');
const nextWin = getBlock('\\{/\\* \\(Next Win', '\\)}');
const smartBuckets = getBlock('\\{/\\* 4 — Smart Buckets\\. \\*/\\}', '</motion\\.div>');
const insights = getBlock('\\{/\\* 5 - Insights', '</motion\\.div>');
const activity = getBlock('\\{/\\* 6 — Activity', '</motion\\.section>');

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

  const layoutStart = db.indexOf('<motion.div variants={dashboardSectionVariants}>\n        <ActionAlert');
  const layoutEnd = db.indexOf('</motion.section>') + '</motion.section>'.length;
  
  if (layoutStart !== -1 && layoutEnd !== -1) {
    db = db.substring(0, layoutStart) + newLayout + db.substring(layoutEnd);
  }
}

// Write it
fs.writeFileSync('src/pages/Dashboard.tsx', db);
console.log('Restored F6 tweaks');
