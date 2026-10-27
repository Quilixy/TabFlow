import { describe, expect, it } from 'vitest';
import { diffSyncedState, parseNavigateRequest, pickSyncedState, preserveForeignFields, type SyncedUiState } from './uiSync';

const record = (state: Record<string, unknown>) => JSON.stringify({ state, version: 0 });

describe('pickSyncedState', () => {
  it('yalnızca senkronlanacak ayarları alır, gezinti durumunu almaz', () => {
    const patch = pickSyncedState(
      record({
        theme: 'dark',
        accent: 'emerald',
        pack: 'sakura',
        decor: false,
        animation: 'fade',
        deepPreview: false,
        closeOnAdd: true,
        lastBackupAt: 123,
        selectedFolderId: 'bayat-klasor',
        expanded: { a: true },
      }),
    );
    expect(patch).toEqual({
      theme: 'dark',
      accent: 'emerald',
      pack: 'sakura',
      decor: false,
      animation: 'fade',
      deepPreview: false,
      closeOnAdd: true,
      lastBackupAt: 123,
    });
  });

  it('geçersiz değerleri atar, geçerli olanları korur', () => {
    expect(pickSyncedState(record({ theme: 'mor', accent: 'neon', pack: 'orman', decor: 'evet', closeOnAdd: true }))).toEqual({
      closeOnAdd: true,
    });
  });

  it('bozuk veya boş kayıtta null döner', () => {
    expect(pickSyncedState(null)).toBeNull();
    expect(pickSyncedState('{bozuk')).toBeNull();
    expect(pickSyncedState('{"state": 5}')).toBeNull();
    expect(pickSyncedState('[]')).toBeNull();
  });

  it('lastBackupAt null değerini kabul eder', () => {
    expect(pickSyncedState(record({ lastBackupAt: null }))).toEqual({ lastBackupAt: null });
  });
});

describe('diffSyncedState', () => {
  const current: SyncedUiState = {
    theme: 'dark',
    accent: 'indigo',
    animation: 'pop',
    pack: 'default',
    decor: true,
    deepPreview: true,
    language: 'auto',
    closeOnAdd: false,
    lastBackupAt: null,
  };

  it('aynı değerler için null döner (pencereler arası sonsuz döngü olmaz)', () => {
    expect(diffSyncedState(current, { ...current })).toBeNull();
    expect(diffSyncedState(current, null)).toBeNull();
  });

  it('yalnızca değişen alanları döndürür', () => {
    expect(diffSyncedState(current, { ...current, theme: 'light', closeOnAdd: true })).toEqual({
      theme: 'light',
      closeOnAdd: true,
    });
  });
});

describe('parseNavigateRequest', () => {
  it('geçerli ve taze isteği okur', () => {
    expect(parseNavigateRequest(JSON.stringify({ id: 'a', at: 1000 }), 2000)).toBe('a');
  });

  it('eski, bozuk veya eksik isteği yok sayar', () => {
    expect(parseNavigateRequest(JSON.stringify({ id: 'a', at: 0 }), 120_000)).toBeNull();
    expect(parseNavigateRequest('{bozuk', 0)).toBeNull();
    expect(parseNavigateRequest(JSON.stringify({ at: 0 }), 0)).toBeNull();
    expect(parseNavigateRequest(null)).toBeNull();
  });
});

describe('preserveForeignFields', () => {
  it('sahibi olunmayan alanı depodaki değerle korur', () => {
    const stored = record({ popupExpanded: { x: true }, theme: 'dark' });
    const outgoing = record({ popupExpanded: {}, theme: 'light' });
    const merged = JSON.parse(preserveForeignFields(outgoing, stored, ['popupExpanded']));
    expect(merged.state).toEqual({ popupExpanded: { x: true }, theme: 'light' });
  });

  it('depo boşsa ya da bozuksa gideni aynen bırakır', () => {
    const outgoing = record({ theme: 'light' });
    expect(preserveForeignFields(outgoing, null, ['popupExpanded'])).toBe(outgoing);
    expect(preserveForeignFields(outgoing, '{bozuk', ['popupExpanded'])).toBe(outgoing);
  });
});
