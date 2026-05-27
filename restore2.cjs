const fs = require('fs');

let db = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');
db = db.replace(/\r\n/g, '\n');

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
db = db.replace(/type BucketDragMode = 'edit' \| 'transfer';\n/, '');
db = db.replace(/const \[bucketDragMode, setBucketDragMode\] = useState<BucketDragMode>\('transfer'\);\n/, 'const [isEditingBuckets, setIsEditingBuckets] = useState(false);\n');
db = db.replace(/mode=\{bucketDragMode\}/g, 'mode={isEditingBuckets ? "edit" : undefined}');

// Remove segmented control
db = db.replace(/<div className="flex shrink-0 items-center gap-1 rounded-pill bg-surfaceAlt p-1 shadow-neuPressed">[\s\S]*?<\/div>/, `<Button
                    variant={isEditingBuckets ? "action" : "secondary"}
                    size="sm"
                    onClick={() => setIsEditingBuckets(prev => !prev)}
                  >
                    {isEditingBuckets ? copy.common.done : "Edit"}
                  </Button>`);

// Remove BucketDragHint components and state
db = db.replace(/import \{ BucketDragHint \} from '\.\.\/components\/BucketDragHint\/BucketDragHint';\n/, '');
db = db.replace(/const bucketDragHintDistance = 42; \/\/ px drag to trigger hint\n/, '');
db = db.replace(/const \[bucketDragHintSeenOnAccount, setBucketDragHintSeenOnAccount\] = useState\(false\);\n/, '');
db = db.replace(/const \[bucketDragHintMarkedThisSession, setBucketDragHintMarkedThisSession\] = useState\(false\);\n/, '');
db = db.replace(/const handleBucketDragHintShown = useCallback\([\s\S]*?}, \[\]\);\n/, '');
db = db.replace(/const handleBucketDragHintDismiss = useCallback\([\s\S]*?}, \[\]\);\n/, '');
db = db.replace(/<BucketDragHint[\s\S]*?\/>/g, '');

// Remove dragHintRole and dragHintOffset from BucketDragCard
db = db.replace(/                  dragHintRole=\{[\s\S]*?\n\s+dragHintOffset=\{[\s\S]*?\n/g, '');

// Remove team navigation
db = db.replace(/          onMemberClick=\{handleTeamMemberClick\}\n/g, '');

// Save changes
fs.writeFileSync('src/pages/Dashboard.tsx', db);
console.log('Restored correctly');
