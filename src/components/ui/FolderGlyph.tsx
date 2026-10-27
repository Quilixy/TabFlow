import type { ReactElement, SVGProps } from 'react';
import { folderColorCss, isFolderIcon, type FolderIconId } from '../../utils/folderStyle';
import {
  BookIcon,
  BookmarkIcon,
  BriefcaseIcon,
  CalendarIcon,
  CameraIcon,
  CartIcon,
  ChartIcon,
  CodeIcon,
  CoffeeIcon,
  DumbbellIcon,
  FilmIcon,
  FlagIcon,
  FlaskIcon,
  FolderIcon,
  GamepadIcon,
  GlobeIcon,
  HeartIcon,
  HomeIcon,
  LeafIcon,
  LightbulbIcon,
  LockIcon,
  MailIcon,
  MusicIcon,
  NewspaperIcon,
  PaletteIcon,
  PawIcon,
  PlaneIcon,
  PlanetIcon,
  RocketIcon,
  SchoolIcon,
  StarIcon,
  TerminalIcon,
  UtensilsIcon,
  WalletIcon,
  ZapIcon,
} from './icons';

type IconComponent = (props: SVGProps<SVGSVGElement>) => ReactElement;

const ICONS: Record<FolderIconId, IconComponent> = {
  folder: FolderIcon,
  star: StarIcon,
  heart: HeartIcon,
  bookmark: BookmarkIcon,
  briefcase: BriefcaseIcon,
  book: BookIcon,
  code: CodeIcon,
  terminal: TerminalIcon,
  cart: CartIcon,
  music: MusicIcon,
  globe: GlobeIcon,
  zap: ZapIcon,
  home: HomeIcon,
  rocket: RocketIcon,
  planet: PlanetIcon,
  camera: CameraIcon,
  film: FilmIcon,
  gamepad: GamepadIcon,
  school: SchoolIcon,
  plane: PlaneIcon,
  coffee: CoffeeIcon,
  food: UtensilsIcon,
  sport: DumbbellIcon,
  wallet: WalletIcon,
  chart: ChartIcon,
  calendar: CalendarIcon,
  mail: MailIcon,
  palette: PaletteIcon,
  idea: LightbulbIcon,
  science: FlaskIcon,
  leaf: LeafIcon,
  paw: PawIcon,
  flag: FlagIcon,
  lock: LockIcon,
  news: NewspaperIcon,
};

interface FolderGlyphProps extends SVGProps<SVGSVGElement> {
  icon?: string;
  color?: string;
}

/** Klasörün seçilen simgesini seçilen renkte (yoksa vurgu rengiyle) çizer. */
export function FolderGlyph({ icon, color, style, ...rest }: FolderGlyphProps) {
  const Component = isFolderIcon(icon) ? ICONS[icon] : FolderIcon;
  return <Component style={{ color: folderColorCss(color), ...style }} {...rest} />;
}
