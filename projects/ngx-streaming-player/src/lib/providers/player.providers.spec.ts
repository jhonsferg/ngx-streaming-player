import {
  providePlayer,
  withTranslations,
  withTheme,
  withDefaults,
  PlayerFeatureKind,
} from './player.providers';
import { PLAYER_TRANSLATIONS, PLAYER_THEME, PLAYER_DEFAULTS } from '../tokens/player.tokens';

describe('player.providers', () => {
  describe('withTranslations', () => {
    it('returns a Translations feature carrying the provided map', () => {
      const feature = withTranslations({ play: 'Reproducir' });

      expect(feature.ɵkind).toBe(PlayerFeatureKind.Translations);
      expect(feature.ɵproviders).toEqual([
        { provide: PLAYER_TRANSLATIONS, useValue: { play: 'Reproducir' } },
      ]);
    });
  });

  describe('withTheme', () => {
    it('returns a Theme feature carrying the provided overrides', () => {
      const feature = withTheme({ primaryColor: '#3b82f6' });

      expect(feature.ɵkind).toBe(PlayerFeatureKind.Theme);
      expect(feature.ɵproviders).toEqual([
        { provide: PLAYER_THEME, useValue: { primaryColor: '#3b82f6' } },
      ]);
    });
  });

  describe('withDefaults', () => {
    it('returns a Defaults feature carrying the provided config', () => {
      const feature = withDefaults({ autoplay: true, enablePiP: false });

      expect(feature.ɵkind).toBe(PlayerFeatureKind.Defaults);
      expect(feature.ɵproviders).toEqual([
        { provide: PLAYER_DEFAULTS, useValue: { autoplay: true, enablePiP: false } },
      ]);
    });
  });

  describe('providePlayer', () => {
    it('returns environment providers when called with no features', () => {
      const providers = providePlayer();

      expect(providers).toBeTruthy();
      expect((providers as any).ɵproviders).toEqual([]);
    });

    it('flattens the providers of every feature passed in', () => {
      const providers = providePlayer(
        withTranslations({ play: 'Play' }),
        withTheme({ primaryColor: '#fff' }),
        withDefaults({ muted: true }),
      );

      expect((providers as any).ɵproviders).toEqual([
        { provide: PLAYER_TRANSLATIONS, useValue: { play: 'Play' } },
        { provide: PLAYER_THEME, useValue: { primaryColor: '#fff' } },
        { provide: PLAYER_DEFAULTS, useValue: { muted: true } },
      ]);
    });
  });
});
