import type {StyleProp, ViewStyle} from 'react-native';
import {
  Armchair, ArrowLeft, BadgePercent, SlidersHorizontal, ShoppingBag, Settings2, Tag, Wallet, ArrowRight, ArrowUpRight, Bell, Bot, Building2, Car, CalendarDays, Check, ChevronDown, ChevronRight,
  ChevronUp, Circle, CircleAlert, CircleCheck, CircleDot, CircleUserRound, Clapperboard, Clock3, Compass, CreditCard, Eye, EyeOff,
  Heart, LocateFixed, LogOut, Mail, MapPin, Moon, Navigation, Popcorn, QrCode, RefreshCw, Search, Send, Sparkles, Star, Sun,
  Minus, Plus, Ticket, TriangleAlert, UserRound, X, type LucideIcon,
} from 'lucide-react-native';
import {useCineHuntTheme} from './theme';

/** Bản đồ tên ngữ nghĩa -> icon. Đổi icon ở một nơi, mọi màn hình cùng đổi. */
const ICONS = {
  movies: Clapperboard, discover: Compass, tickets: Ticket, account: CircleUserRound, assistant: Sparkles, bot: Bot,
  sun: Sun, moon: Moon,
  back: ArrowLeft, forward: ArrowRight, external: ArrowUpRight, chevronDown: ChevronDown, chevronUp: ChevronUp, chevronRight: ChevronRight,
  search: Search, heart: Heart, star: Star, pin: MapPin, locate: LocateFixed, navigate: Navigation, car: Car,
  calendar: CalendarDays, clock: Clock3, seat: Armchair, card: CreditCard, qr: QrCode, popcorn: Popcorn, bell: Bell,
  logout: LogOut, eye: Eye, eyeOff: EyeOff, close: X, success: CircleCheck, error: CircleAlert, warning: TriangleAlert,
  filter: SlidersHorizontal, promo: BadgePercent, bag: ShoppingBag, settings: Settings2, tag: Tag, wallet: Wallet,
  minus: Minus, plus: Plus,
  refresh: RefreshCw, send: Send, mail: Mail, check: Check, radio: Circle, radioOn: CircleDot, building: Building2, user: UserRound,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

type AppIconProps = {
  name: IconName;
  size?: number;
  /** Mặc định: màu chữ chính của theme hiện tại. */
  color?: string;
  strokeWidth?: number;
  /** Tô đặc (ví dụ trái tim đã yêu thích, sao). */
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Icon trang trí: ẩn khỏi trình đọc màn hình. Nhãn truy cập phải đặt ở
 * Pressable/Text cha (accessibilityLabel), không đặt trên icon.
 */
export function AppIcon({name, size = 20, color, strokeWidth = 2, filled = false, style}: AppIconProps) {
  const {C} = useCineHuntTheme();
  const Icon = ICONS[name];
  const tint = color ?? C.textPrimary;
  return <Icon size={size} color={tint} strokeWidth={strokeWidth} fill={filled ? tint : 'none'} style={style}
    accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/>;
}
