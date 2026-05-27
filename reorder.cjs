const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');

// 1. Update merged activity limit from 3 to 1
content = content.replace(
  /buildMergedActivity\([\s\S]*?bucketEventItems,\s*3,\s*user\?\.id/m,
  match => match.replace(',\n    3,', ',\n    1,')
);

// 2. Extract sections
const getBlock = (startRegex, endRegex) => {
  const match = content.match(new RegExp(startRegex + '[\\s\\S]*?' + endRegex));
  return match ? match[0] : null;
};

// We will extract and replace the layout from ActionAlert down to ActivityHistoryModal.
const layoutStartStr = '      <motion.div variants={dashboardSectionVariants}>\n        <ActionAlert';
const layoutEndStr = '      </motion.section>';
const startIndex = content.indexOf(layoutStartStr);
const endIndex = content.indexOf(layoutEndStr, startIndex) + layoutEndStr.length;

if (startIndex === -1 || endIndex === -1) {
  console.error("Layout bounds not found");
  process.exit(1);
}

const layoutBlock = content.substring(startIndex, endIndex);

const extractBlock = (markerStart, markerEnd) => {
  const s = layoutBlock.indexOf(markerStart);
  if (s === -1) return null;
  const e = layoutBlock.indexOf(markerEnd, s) + markerEnd.length;
  return layoutBlock.substring(s, e);
};

const actionAlert = extractBlock('<motion.div variants={dashboardSectionVariants}>\n        <ActionAlert', '</motion.div>');
const teamSummary = extractBlock('{/* 2 — Team summary. */}', '</motion.div>');
const savingPlan = extractBlock('{/* 3 — Saving Plan island', '</motion.div>');
const nextWin = extractBlock('{/* (Next Win', ')}');
const smartBuckets = extractBlock('{/* 4 — Smart Buckets. */}', '</motion.div>');
const insightsFull = extractBlock('{/* 5 - Insights.', '</motion.div>');
const activity = extractBlock('{/* 6 — Activity.', '</motion.section>');

// Split insights into MiniTimeline and MomentumChart
const timelineMatch = insightsFull.match(/<MiniTimeline[\s\S]*?\/>/);
let miniTimeline = timelineMatch ? timelineMatch[0] : '';
let momentumChartBlock = insightsFull
  .replace(miniTimeline, '')
  .replace('className="flex min-h-[21rem] flex-col gap-3"', ''); // remove flex/gap if any

// Inject compact props
let newSavingPlan = savingPlan.replace('onDeposit={handleDepositFromPlan}', 'onDeposit={handleDepositFromPlan}\n          compact');
let newMiniTimeline = miniTimeline.replace('onOpenTimeline={handleTimelineOpen}', 'onOpenTimeline={handleTimelineOpen}\n          compact');

const newLayout = `${newSavingPlan}

      <motion.div variants={dashboardSectionVariants}>
        ${newMiniTimeline}
      </motion.div>

      ${actionAlert}

      ${nextWin}

      ${smartBuckets}

      ${teamSummary}

      ${momentumChartBlock}

      ${activity}`;

content = content.substring(0, startIndex) + newLayout + content.substring(endIndex);

fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log("Success");
