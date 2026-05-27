const fs = require('fs');

// 1. Fix th.ts
let thContent = fs.readFileSync('src/i18n/locales/th.ts', 'utf-8');
thContent = thContent.replace(/gotIt:\s*'เข้าใจแล้ว',/, "done: 'เสร็จสิ้น',\n    next: 'ถัดไป',");
fs.writeFileSync('src/i18n/locales/th.ts', thContent);

// 2. Fix Dashboard.tsx
let dashboardContent = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');

// Remove unused imports/variables
const removals = [
  "import { BucketDragHint } from '../components/BucketDragHint/BucketDragHint';",
  "import { IconEdit, IconSwap } from '../components/Icon/Icon';",
  "import { ScrollFadeContainer } from '../components/ScrollFadeContainer/ScrollFadeContainer';",
  /const depositSlipMarker =[^;]+;/g,
  /type BucketDragMode =[^;]+;/g,
  /const bucketDragHintDistance =[^;]+;/g,
  /const \[searchParams, setSearchParams\] = useSearchParams\(\);/g,
  /const { loading: profileLoading[^}]+} = useProfile\(\);/g,
  /const roomMembersBucketsByUser[^;]+;/g,
  /const \[bucketReorderSaving[^;]+;/g,
  /const \[bucketDragHintMarkedThisSession[^;]+;/g,
  /const handleBucketDragHintShown =[^}]+};/g,
  /const handleBucketDragHintDismiss =[^}]+};/g,
  /const bucketDragHintSeenOnAccount =[^;]+;/g,
];

for (const r of removals) {
  if (typeof r === 'string') {
    dashboardContent = dashboardContent.replace(r, '');
  } else {
    dashboardContent = dashboardContent.replace(r, '');
  }
}

// remove any remaining 'IconEdit, ' or ', IconSwap' from imports since they might be mixed
dashboardContent = dashboardContent.replace(/IconEdit,\s*/, '');
dashboardContent = dashboardContent.replace(/,\s*IconSwap/, '');

fs.writeFileSync('src/pages/Dashboard.tsx', dashboardContent);
console.log('Cleanup done');
