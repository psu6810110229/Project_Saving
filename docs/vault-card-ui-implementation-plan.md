# Vault Card UI Implementation Plan (Dashboard)

## Objective
ปรับ `TotalVaultCard` ให้ข้อมูลไม่ซ้ำ, ดูคลีนขึ้น, และยังคงข้อมูลสำคัญครบตามแนวทางที่ตกลง:

- คงตัวเลขหลัก `saved / target` + progress bar
- ลบกรอบของ `%` และไอคอนดินสอ
- ไม่ย่อรายชื่อ cardholders เป็น `+N` (แสดงรายชื่อเต็มตามลำดับ)
- ตัดบล็อกล่าง "Saved/Target" ที่ซ้ำซ้อน
- เติมแถวข้อมูลเชิงใช้งาน (actionable insights) ใต้ progress

---

## Current State (from code)

Component หลักอยู่ที่ `src/components/TotalVaultCard/TotalVaultCard.tsx` โดยปัจจุบันมีจุดที่ต้องปรับ:

1. มี badge `%` แบบมีกรอบ/พื้นหลัง
2. ปุ่มแก้ไขใช้ `IconButton` variant `glass` (มีกรอบ)
3. มีกล่องล่าง 2 ฝั่ง (PiggyBank/TrendingUp) ที่ซ้ำกับตัวเลขหลัก
4. cardholders ถูก truncate และย่อชื่อเกิน 3 คนเป็น `+N`

---

## Scope

### In Scope
- ปรับโครงสร้าง UI ของ `TotalVaultCard`
- เพิ่ม helper คำนวณข้อมูล insight
- เพิ่ม copy i18n (TH/EN) สำหรับ insight labels
- ผูกข้อมูล due date จาก dashboard เข้า card เพื่อคำนวณเวลา/เดือนที่เหลือ

### Out of Scope
- redesign หน้าอื่นนอก Dashboard
- เปลี่ยน logic ธุรกิจเรื่องแผนการออมทั้งระบบ
- marquee/animation รายชื่อ cardholders

---

## Proposed UI Structure

1. Header row
   - ซ้าย: title (`recordedVault`)
   - ขวา: `%` แบบ plain text + ไอคอนดินสอแบบ plain icon (no frame)
2. Main amount row
   - `฿saved / ฿target`
3. Progress bar
4. Insight row (single line, wrap ได้)
   - `เหลืออีก ... • เหลือเวลา ... • ต้องเก็บ/เดือน ...`
5. Footer metadata row
   - Cardholders (full names, no `+N`)
   - Valid thru

---

## Data & Logic Changes

### 1) Add derived metrics in `TotalVaultCard`

เพิ่ม props:
- `deadlineDate?: string | null` (ISO date from room goal)

คำนวณ:
- `remaining = Math.max(target - saved, 0)`
- `monthsLeft` (อย่างน้อย 1 เมื่อตั้ง deadline ในอนาคต) จาก current date ถึง deadline
- `requiredPerMonth = remaining / monthsLeft` (เมื่อมี deadline และ monthsLeft > 0)

หมายเหตุ:
- ถ้าไม่มี deadline ให้แสดง `—`
- ถ้าเกินเป้าแล้ว required/month = 0

### 2) Dashboard prop plumbing

ใน `src/pages/Dashboard.tsx` ส่ง `roomGoalTarget?.targetDate` (หรือฟิลด์ due date ที่ใช้งานจริงในไฟล์) ไปยัง `TotalVaultCard` ผ่าน prop `deadlineDate`.

### 3) i18n copy additions

เพิ่ม keys (TH/EN):
- `vaultInsightRemaining`
- `vaultInsightTimeLeft`
- `vaultInsightMonthlyNeeded`
- `vaultInsightNoDeadline`

รูปแบบเป็น function สำหรับ amount/string ที่ format แล้ว.

---

## Step-by-step Implementation

1. Refactor `TotalVaultCard` UI
   - เอา `IconPiggyBank`, `IconTrendingUp` section ออก
   - เปลี่ยน `%` badge เป็น text span (no border/background)
   - เปลี่ยน edit button จาก `IconButton` เป็น plain button/icon style
2. Add insight helpers
   - ฟังก์ชันคำนวณ months left และ monthly required
   - render insight line พร้อม fallback
3. Keep full cardholder names
   - เปลี่ยน logic รายชื่อให้ join ทั้งหมดโดยไม่ทำ `+N`
   - ยังคง `truncate` เพื่อไม่ล้น layout
4. Wire deadline from Dashboard
   - ส่ง prop `deadlineDate` เข้า card
5. Update i18n
   - เติม TH/EN keys และใช้งานผ่าน `copy.dashboard.*`
6. QA + visual check
   - ทดสอบหน้าจอความกว้างมือถือทั่วไป (360/390/430)
   - ตรวจความอ่านง่ายบนพื้นหลังหลากหลาย

---

## Validation Checklist

- [ ] ไม่มีข้อมูล Saved/Target ซ้ำซ้อนในบล็อกล่าง
- [ ] `%` และ edit icon ไม่มีกรอบ
- [ ] รายชื่อ cardholders ไม่ถูกย่อเป็น `+N`
- [ ] Insight row แสดงครบ 3 ค่าเมื่อมี deadline
- [ ] กรณีไม่มี deadline แสดง fallback ที่เข้าใจได้
- [ ] TH/EN copy ครบและไม่พัง type checks
- [ ] layout ไม่ล้นบนจอเล็ก

---

## Risks / Edge Cases

1. **รายชื่อยาวมาก**
   - ใช้ `truncate` ระดับแถว; ถ้าต้องการทั้งหมดจริงให้พิจารณา tooltip ใน phase ถัดไป
2. **deadline malformed**
   - helper parse date ต้อง fail-safe กลับไป `—`
3. **timezone drift**
   - คำนวณเดือนแบบ calendar-based, ไม่ยึด milliseconds เพียว ๆ
4. **target = 0**
   - กันหารศูนย์ทั้ง progress และ monthly

---

## Suggested PR Breakdown

- PR 1 (UI + behavior): `TotalVaultCard` refactor + deadline prop wiring
- PR 2 (copy polish): TH/EN wording fine-tune
- PR 3 (optional): follow-up accessibility/micro-interactions

หากต้องรวมเป็น PR เดียว ให้ merge ตามลำดับ: data plumbing -> UI -> copy -> QA.
