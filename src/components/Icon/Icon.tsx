import {
  AirplaneTilt,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowsLeftRight,
  Bed,
  Bell,
  Briefcase,
  Calendar,
  CalendarDots,
  Camera,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  Clock,
  ClockCountdown,
  Crown,
  DeviceMobile,
  DotsThreeVertical,
  Fire,
  Flag,
  ForkKnife,
  Gear,
  Heart,
  House,
  Image,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Palette,
  PencilSimple,
  PiggyBank,
  Plus,
  Pulse,
  QrCode,
  Receipt,
  RocketLaunch,
  ShieldCheck,
  SquaresFour,
  Stack,
  Ticket,
  Trash,
  TrendUp,
  User,
  UserPlus,
  Users,
  Vault,
  Warning,
  X,
  type Icon as PhosphorIcon,
  type IconProps as PhosphorIconProps,
  type IconWeight,
} from '@phosphor-icons/react';

type IconDefaultWeight = Extract<IconWeight, 'regular' | 'duotone' | 'fill'>;

interface IconProps extends Omit<PhosphorIconProps, 'size' | 'weight'> {
  size?: number;
  weight?: IconDefaultWeight;
}

const make = (Phosphor: PhosphorIcon, defaultWeight: IconDefaultWeight) => {
  function AppIcon({ size = 20, weight, className, ...rest }: IconProps) {
    return (
      <Phosphor
        size={size}
        weight={weight ?? defaultWeight}
        className={className}
        {...rest}
        aria-hidden
      />
    );
  }

  return AppIcon;
};

export const IconPlane = make(AirplaneTilt, 'duotone');
export const IconBed = make(Bed, 'duotone');
export const IconFork = make(ForkKnife, 'duotone');
export const IconTicket = make(Ticket, 'duotone');
export const IconHome = make(House, 'duotone');
export const IconBriefcase = make(Briefcase, 'duotone');
export const IconSmartphone = make(DeviceMobile, 'duotone');
export const IconHeart = make(Heart, 'duotone');
export const IconPiggyBank = make(PiggyBank, 'duotone');
export const IconRocket = make(RocketLaunch, 'duotone');
export const IconPalette = make(Palette, 'duotone');
export const IconBell = make(Bell, 'duotone');
export const IconGear = make(Gear, 'duotone');
export const IconChevronDown = make(CaretDown, 'regular');
export const IconChevronLeft = make(CaretLeft, 'regular');
export const IconChevronRight = make(CaretRight, 'regular');
export const IconArrowLeft = make(ArrowLeft, 'regular');
export const IconArrowRight = make(ArrowRight, 'regular');
export const IconSwap = make(ArrowsLeftRight, 'regular');
export const IconPlus = make(Plus, 'regular');
export const IconCheck = make(Check, 'regular');
export const IconX = make(X, 'regular');
export const IconCalendar = make(Calendar, 'duotone');
export const IconFlag = make(Flag, 'duotone');
export const IconUserPlus = make(UserPlus, 'duotone');
export const IconTrash = make(Trash, 'regular');
export const IconEdit = make(PencilSimple, 'regular');
export const IconQrCode = make(QrCode, 'duotone');
export const IconTrendingUp = make(TrendUp, 'duotone');
export const IconMoreVertical = make(DotsThreeVertical, 'regular');
export const IconGrid = make(SquaresFour, 'duotone');
export const IconLayers = make(Stack, 'duotone');
export const IconVault = make(Vault, 'duotone');
export const IconActivity = make(Pulse, 'duotone');
export const IconUser = make(User, 'duotone');
export const IconUsers = make(Users, 'duotone');
export const IconSlip = make(Receipt, 'duotone');
export const IconClock = make(Clock, 'duotone');
export const IconClockAlert = make(ClockCountdown, 'duotone');
export const IconWarning = make(Warning, 'duotone');
export const IconCheckCircle = make(CheckCircle, 'duotone');
export const IconFire = make(Fire, 'duotone');
export const IconCrown = make(Crown, 'duotone');
export const IconCalendarClock = make(CalendarDots, 'duotone');
export const IconArrowUpRight = make(ArrowUpRight, 'regular');
export const IconShield = make(ShieldCheck, 'duotone');
export const IconImage = make(Image, 'duotone');
export const IconCamera = make(Camera, 'duotone');
export const IconZoomIn = make(MagnifyingGlassPlus, 'regular');
export const IconZoomOut = make(MagnifyingGlassMinus, 'regular');
