const fs = require('fs');

// Fix th.ts duplicate
let thContent = fs.readFileSync('src/i18n/locales/th.ts', 'utf-8');
// Keep only one 'done' and one 'next'
thContent = thContent.replace(/done: 'เสร็จสิ้น',\s*done: 'เสร็จสิ้น',/, "done: 'เสร็จสิ้น',");
thContent = thContent.replace(/next: 'ถัดไป',\s*next: 'ถัดไป',/, "next: 'ถัดไป',");
fs.writeFileSync('src/i18n/locales/th.ts', thContent);

// Fix Dashboard.tsx
let dbContent = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');

// remove useSearchParams
dbContent = dbContent.replace(/import { useSearchParams } from 'react-router-dom';/, "import {} from 'react-router-dom';");

// remove depositSlipMarker
dbContent = dbContent.replace(/const depositSlipMarker =[^;]+;/g, '');

// remove bucketDragHintDistance
dbContent = dbContent.replace(/const bucketDragHintDistance =[^;]+;/g, '');

// remove dataProfile / profileLoading
dbContent = dbContent.replace(/const { data: dataProfile, loading: profileLoading, error: profileError } = useProfile\(\);/, "const { error: profileError } = useProfile();");

// remove roomMembersBucketsByUser
dbContent = dbContent.replace(/const roomMembersBucketsByUser = useMemo\(\(\) => {[\s\S]*?}, \[data\.roomMembersBuckets\.allBuckets\]\);/, "");

// remove setBucketReorderSaving
dbContent = dbContent.replace(/setBucketReorderSaving\(true\);/g, '');
dbContent = dbContent.replace(/setBucketReorderSaving\(false\);/g, '');

// remove setBucketDragHintMarkedThisSession
dbContent = dbContent.replace(/setBucketDragHintMarkedThisSession\(true\);/g, '');

// remove handleBucketDragHintShown and handleBucketDragHintDismiss
dbContent = dbContent.replace(/const handleBucketDragHintShown =[\s\S]*?};/, '');
dbContent = dbContent.replace(/const handleBucketDragHintDismiss =[\s\S]*?};/, '');

fs.writeFileSync('src/pages/Dashboard.tsx', dbContent);
console.log('Fixed');
