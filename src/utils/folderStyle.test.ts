import { describe, expect, it } from 'vitest';
import { DEFAULT_FOLDER_COLOR_CSS, FOLDER_COLORS, folderColorCss, isFolderColor, isFolderIcon } from './folderStyle';

describe('folderStyle', () => {
  it('yalnızca tanımlı renk ve simge kimliklerini kabul eder', () => {
    expect(isFolderColor('rose')).toBe(true);
    expect(isFolderColor('neon')).toBe(false);
    expect(isFolderColor('toString')).toBe(false);
    expect(isFolderColor(undefined)).toBe(false);
    expect(isFolderIcon('star')).toBe(true);
    expect(isFolderIcon('constructor')).toBe(false);
  });

  it('renk yoksa temanın vurgu rengini kullanır', () => {
    expect(folderColorCss(undefined)).toBe(DEFAULT_FOLDER_COLOR_CSS);
    expect(folderColorCss('bilinmeyen')).toBe(DEFAULT_FOLDER_COLOR_CSS);
    expect(folderColorCss('sky')).toBe(FOLDER_COLORS.sky);
  });
});
