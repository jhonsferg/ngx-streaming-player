import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { providePlayer, withTheme, withDefaults, withTranslations } from 'ngx-streaming-player';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    providePlayer(
      withTheme({ primaryColor: '#E76F51', borderRadius: '12px' }),
      withDefaults({ autoplay: false, enablePiP: true, enableKeyboard: true }),
      withTranslations({
        play: 'Play (k)',
        pause: 'Pause (k)',
        settings: 'Settings',
        quality: 'Quality',
        speed: 'Speed',
        captionsTracks: 'Subtitles',
        auto: 'Auto',
        normalSpeed: 'Normal',
        subtitlesOff: 'Off',
        live: 'LIVE',
      }),
    ),
  ],
};
