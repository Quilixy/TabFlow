import type { ReactElement, SVGProps } from 'react';
import { folderColorCss, isFolderIcon, type FolderIconId } from '../../utils/folderStyle';
import {
  BookIcon,
  BookmarkIcon,
  BriefcaseIcon,
  CartIcon,
  CodeIcon,
  FolderIcon,
  GlobeIcon,
  HeartIcon,
  HomeIcon,
  MusicIcon,
  PlanetIcon,
  RocketIcon,
  StarIcon,
  TerminalIcon,
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
