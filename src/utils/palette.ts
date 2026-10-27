import { foldText } from './search';

export interface PaletteCommand {
  id: string;
  label: string;
  /** Sağda soluk gösterilen kısa açıklama (ör. "Klasöre git"). */
  hint?: string;
  group: 'action' | 'folder';
  run: () => void;
}

/** Çok sayıda klasörde liste kısa kalsın. */
const MAX_RESULTS = 50;

/** Sorgunun her kelimesi etikette geçiyorsa eşleşir (Türkçe karakterlere duyarsız). */
export function filterCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  const matches = words.length === 0 ? commands : commands.filter((c) => words.every((w) => foldText(c.label).includes(w)));
  return matches.slice(0, MAX_RESULTS);
}
