import type { Src } from '../../core/api/src-types';
import { isDASHSrc, isHLSSrc } from '../../utils/mime';
import { isHLSSupported } from '../../utils/support';
import type { MediaProviderLoader } from '../types';
import { VideoProviderLoader } from '../video/loader';
import type { ShakaProvider } from './provider';

export class ShakaProviderLoader
  extends VideoProviderLoader
  implements MediaProviderLoader<ShakaProvider>
{
  static supported = isHLSSupported();

  override readonly name = 'shaka';

  override canPlay(src: Src) {
    return ShakaProviderLoader.supported && (isHLSSrc(src) || isDASHSrc(src));
  }

  override async load(context) {
    if (__SERVER__) {
      throw Error('[vidstack] can not load shaka provider server-side');
    }

    if (__DEV__ && !this.target) {
      throw Error(
        '[vidstack] `<video>` element was not found - did you forget to include `<media-provider>`?',
      );
    }

    return new (await import('./provider')).ShakaProvider(this.target, context);
  }
}
