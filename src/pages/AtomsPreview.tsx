import { useState } from 'react';
import { Avatar } from '../components/Avatar/Avatar';
import { BottomTabItem } from '../components/BottomTabItem/BottomTabItem';
import { Button } from '../components/Button/Button';
import { CategoryTile } from '../components/CategoryTile/CategoryTile';
import { Chip } from '../components/Chip/Chip';
import { IconButton } from '../components/IconButton/IconButton';
import { IconBubble } from '../components/IconBubble/IconBubble';
import { OtpDigitInput } from '../components/OtpDigitInput/OtpDigitInput';
import { Pill } from '../components/Pill/Pill';
import { ProgressBar } from '../components/ProgressBar/ProgressBar';
import { ProjectedProgressBar } from '../components/ProjectedProgressBar/ProjectedProgressBar';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { TextInput } from '../components/TextInput/TextInput';
import {
  IconActivity,
  IconArrowLeft,
  IconArrowRight,
  IconBell,
  IconBriefcase,
  IconCalendar,
  IconCheck,
  IconEdit,
  IconFork,
  IconGear,
  IconGrid,
  IconHeart,
  IconHome,
  IconPalette,
  IconPiggyBank,
  IconPlane,
  IconPlus,
  IconRocket,
  IconSlip,
  IconSmartphone,
  IconTrash,
  IconTrendingUp,
  IconUser,
  IconUserPlus,
  IconVault,
} from '../components/Icon/Icon';

/**
 * Storybook-style preview route at `/atoms`. Renders every atom shipped in
 * Step 5 against the warm canvas so we can visually verify them against
 * the mockups before composing them into molecules (Step 6).
 *
 * This route is intentionally NOT linked from anywhere in the app — open
 * `/atoms` directly. Will be removed (or moved to a dev-only build flag)
 * once molecules and organisms ship.
 */
export function AtomsPreview() {
  const [pill, setPill] = useState<number>(150);
  const [category, setCategory] = useState<'travel' | 'gadget' | 'wedding'>('travel');
  const [bucketCat, setBucketCat] = useState<'flight' | 'gear' | 'dining' | 'home'>('flight');
  const [code, setCode] = useState('JP82');
  const [activeTab, setActiveTab] = useState<'dash' | 'vault' | 'profile'>('dash');

  return (
    <div className="min-h-[100dvh] py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-10">
        <header className="text-center">
          <SectionLabel tone="brand">GO-OUT · Step 5</SectionLabel>
          <h1 className="text-3xl mt-2">Atoms Preview</h1>
          <p className="text-sm text-ink-muted mt-2">
            Visual smoke test against the mockups. Open `/atoms` in dev to inspect.
          </p>
        </header>

        <Group title="Section labels">
          <div className="flex flex-col gap-1">
            <SectionLabel>Deposit amount</SectionLabel>
            <SectionLabel tone="muted">Total contributed</SectionLabel>
            <SectionLabel tone="brand">Project found</SectionLabel>
          </div>
        </Group>

        <Group title="Buttons">
          <div className="flex flex-col gap-3 items-stretch">
            <Button variant="primary">Create Project</Button>
            <Button variant="action" leadingIcon={<IconPlus size={20} />}>Confirm Deposit</Button>
            <Button variant="action" leadingIcon={<IconPlus size={20} />} size="md" fullWidth>Add Money</Button>
            <Button variant="primary" leadingIcon={<IconRocket size={20} />}>Create Bucket</Button>
            <Button variant="dangerSoft" leadingIcon={<IconTrash size={18} />} size="md">Archive Project</Button>
            <Button variant="ghost" size="md">Go Back</Button>
            <Button variant="primary" disabled>Disabled CTA</Button>
          </div>
        </Group>

        <Group title="Icon buttons">
          <div className="flex items-center gap-3">
            <IconButton variant="ghost" size="md" ariaLabel="Back"><IconArrowLeft /></IconButton>
            <IconButton variant="ghost" size="md" ariaLabel="Settings"><IconGear /></IconButton>
            <IconButton variant="ghost" size="md" ariaLabel="Notifications"><IconBell /></IconButton>
            <IconButton variant="solid" size="lg" ariaLabel="Add bucket"><IconPlus /></IconButton>
          </div>
        </Group>

        <Group title="Quick-add pills">
          <div className="flex items-center justify-center gap-3">
            {[50, 150, 500].map(v => (
              <Pill key={v} selected={pill === v} onClick={() => setPill(v)}>
                +${v}
              </Pill>
            ))}
          </div>
          <p className="text-center text-xs text-ink-muted mt-2">Selected: ${pill}</p>
        </Group>

        <Group title="Avatars">
          <div className="flex items-end gap-6 pt-4">
            <Avatar fallback="P" size="sm" />
            <Avatar fallback="A" size="md" />
            <Avatar fallback="P" size="lg" ring="leader" badge={
              <span className="bg-brand-500 text-ink-inverse text-[10px] font-bold font-mono px-2 py-0.5 rounded-pill">
                Leader
              </span>
            } />
            <Avatar fallback="A" size="lg" ring="theme" themeColor="terracotta" />
            <Avatar fallback="P" size="xl" ring="theme" themeColor="teal" />
          </div>
        </Group>

        <Group title="Progress bars">
          <div className="flex flex-col gap-4">
            <ProgressBar value={45} tone="primary" />
            <ProgressBar value={70} tone="deep" size="lg" />
            <ProgressBar value={28} tone="muted" />
            <ProgressBar value={60} tone="theme" themeHex="#2EA079" />
          </div>
        </Group>

        <Group title="Projected progress bar (Add Money)">
          <div className="flex flex-col gap-2">
            <ProjectedProgressBar current={37} projected={50} />
            <div className="flex justify-between text-xs text-ink-muted font-mono">
              <span>$450 saved</span>
              <span className="text-brand-500 font-bold">+$150 projected → 50%</span>
            </div>
          </div>
        </Group>

        <Group title="OTP digit input">
          <OtpDigitInput value={code} onChange={setCode} />
          <p className="text-center text-xs text-ink-muted mt-3">Code: <span className="font-mono text-brand-800">{code || '(empty)'}</span></p>
        </Group>

        <Group title="OTP digit input — error state">
          <OtpDigitInput value="JP82XC" onChange={() => {}} error />
        </Group>

        <Group title="Category tiles — Project (square)">
          <div className="flex gap-3 overflow-x-auto pb-2">
            <CategoryTile shape="square" label="Travel"  icon={<IconPlane />}      selected={category === 'travel'}  onClick={() => setCategory('travel')} />
            <CategoryTile shape="square" label="Gadget"  icon={<IconSmartphone />} selected={category === 'gadget'}  onClick={() => setCategory('gadget')} />
            <CategoryTile shape="square" label="Wedding" icon={<IconHeart />}      selected={category === 'wedding'} onClick={() => setCategory('wedding')} />
          </div>
        </Group>

        <Group title="Category tiles — Bucket (circle)">
          <div className="flex gap-6 justify-center">
            <CategoryTile shape="circle" label="Travel" icon={<IconPlane />}      selected={bucketCat === 'flight'} onClick={() => setBucketCat('flight')} />
            <CategoryTile shape="circle" label="Gear"   icon={<IconBriefcase />}  selected={bucketCat === 'gear'}   onClick={() => setBucketCat('gear')} />
            <CategoryTile shape="circle" label="Dining" icon={<IconFork />}       selected={bucketCat === 'dining'} onClick={() => setBucketCat('dining')} />
            <CategoryTile shape="circle" label="Home"   icon={<IconHome />}       selected={bucketCat === 'home'}   onClick={() => setBucketCat('home')} />
          </div>
        </Group>

        <Group title="Chips">
          <div className="flex flex-wrap gap-2">
            <Chip tone="peach" icon={<IconSlip size={14} />}>Slip Attached</Chip>
            <Chip tone="peach" icon={<IconPlane size={14} />}>Flights</Chip>
            <Chip tone="white" icon={<IconTrendingUp size={14} />}>+12%</Chip>
            <Chip tone="leaf">On track</Chip>
            <Chip tone="danger">Expired</Chip>
          </div>
        </Group>

        <Group title="Icon bubbles">
          <div className="flex items-end gap-4">
            <IconBubble tone="peach" size="sm"><IconUser size={16} /></IconBubble>
            <IconBubble tone="peach" size="md"><IconPlane size={18} /></IconBubble>
            <IconBubble tone="solid" size="lg"><IconPlane size={26} /></IconBubble>
            <IconBubble tone="solid" size="xl"><IconPiggyBank size={36} /></IconBubble>
            <IconBubble tone="muted" size="md"><span className="font-mono font-bold text-sm">P</span></IconBubble>
          </div>
        </Group>

        <Group title="Text input">
          <div className="flex flex-col gap-3">
            <TextInput leadingIcon={<IconEdit size={16} />} placeholder="e.g. Japan Trip 2025" />
            <TextInput leadingIcon={<span className="font-mono font-bold text-base">฿</span>} placeholder="0.00" />
            <TextInput leadingIcon={<IconCalendar size={16} />} placeholder="mm/dd/yyyy" type="date" />
            <TextInput placeholder="Invalid input" error defaultValue="bad" />
          </div>
        </Group>

        <Group title="Bottom tab bar (sample)">
          <div className="bg-surface rounded-lg shadow-soft px-4 py-2 flex items-center justify-around">
            <BottomTabItem label="Dashboard" icon={<IconGrid />}     active={activeTab === 'dash'}    onClick={() => setActiveTab('dash')} />
            <BottomTabItem label="Vault"     icon={<IconVault />}    active={activeTab === 'vault'}   onClick={() => setActiveTab('vault')} />
            <BottomTabItem label="Profile"   icon={<IconUser />}     active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
          </div>
        </Group>

        <Group title="Trailing icon button preview">
          <div className="flex gap-3">
            <Button variant="primary" trailingIcon={<IconArrowRight size={18} />}>Join Project</Button>
            <Button variant="ghost"   trailingIcon={<IconArrowRight size={18} />}>View All</Button>
          </div>
        </Group>

        <Group title="Misc icons (sanity check)">
          <div className="flex flex-wrap gap-3 text-ink">
            <IconPlane />
            <IconHome />
            <IconBriefcase />
            <IconFork />
            <IconHeart />
            <IconSmartphone />
            <IconPiggyBank />
            <IconRocket />
            <IconPalette />
            <IconBell />
            <IconGear />
            <IconArrowLeft />
            <IconArrowRight />
            <IconPlus />
            <IconCheck />
            <IconCalendar />
            <IconUserPlus />
            <IconTrash />
            <IconEdit />
            <IconTrendingUp />
            <IconActivity />
            <IconVault />
            <IconUser />
            <IconSlip />
            <IconGrid />
          </div>
        </Group>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-raised rounded-lg p-6">
      <h2 className="text-base mb-4 text-ink">{title}</h2>
      {children}
    </section>
  );
}
