import { afterEach, describe, expect, it } from 'vitest';
import { formatAgo, formatSaveAllMessage } from '../utils/format';
import { formatRestoreResult } from '../utils/restore';
import { en } from './en';
import { getLanguage, isLanguageSetting, resolveLanguage, setLanguage, t, tIn } from './index';
import { tr } from './tr';

afterEach(() => setLanguage('tr'));

describe('çeviri', () => {
  it('varsayılan dil Türkçedir', () => {
    expect(getLanguage()).toBe('tr');
    expect(t('common.cancel')).toBe('Vazgeç');
  });

  it('İngilizce sözlük Türkçedeki her anahtarı içerir', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
  });

  it('yer tutucuları doldurur, bilinmeyeni olduğu gibi bırakır', () => {
    expect(t('app.folderCreated', { name: 'İş' })).toBe('“İş” klasörü oluşturuldu.');
    expect(t('app.folderCreated')).toBe('“{name}” klasörü oluşturuldu.');
  });

  it('İngilizcede tekil/çoğul ayırır', () => {
    setLanguage('en');
    expect(t('count.tabs', { n: 1 })).toBe('1 tab');
    expect(t('count.tabs', { n: 3 })).toBe('3 tabs');
    expect(t('trash.buttonLabel', { n: 0 })).toBe('Trash');
    expect(t('trash.buttonLabel', { n: 2 })).toBe('Trash (2 items)');
  });

  it('biçimlendiriciler seçili dilde yazar', () => {
    setLanguage('en');
    expect(formatAgo(0, 2 * 86_400_000)).toBe('2 days ago');
    expect(formatSaveAllMessage(1, 'Work', 2, true)).toBe(
      'Saved 1 tab to “Work”, but the tabs could not be closed. 2 tabs were left open because they aren’t web pages.',
    );
    expect(formatRestoreResult({ mode: 'tabs', opened: 3, skipped: 1, deferred: 0, grouped: 0 }, 'Work')).toBe(
      'Opened 3 tabs, 1 already open.',
    );
  });

  it('belirli bir dilde metin verir ve ayarı çözer', () => {
    expect(tIn('en', 'common.undo')).toBe('Undo');
    expect(resolveLanguage('en')).toBe('en');
    expect(resolveLanguage('tr')).toBe('tr');
    expect(['tr', 'en']).toContain(resolveLanguage('auto'));
    expect(isLanguageSetting('auto')).toBe(true);
    expect(isLanguageSetting('de')).toBe(false);
  });
});
