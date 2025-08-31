import { peek, type Dispose } from 'maverick.js';
import { isString } from 'maverick.js/std';

import type { Src } from '../../core/api/src-types';
import { preconnect } from '../../utils/network';
import { isDASHSupported, isHLSSupported } from '../../utils/support';
import type { MediaProviderAdapter } from '../types';
import { VideoProvider } from '../video/provider';
import { ShakaLibLoader } from './lib-loader';
import { ShakaController } from './shaka';
import type { ShakaConstructor, ShakaInstanceCallback, ShakaLibrary } from './types';

const JS_DELIVR_CDN = 'https://cdn.jsdelivr.net';

export class ShakaProvider extends VideoProvider implements MediaProviderAdapter {
  protected override $$PROVIDER_TYPE = 'SHAKA';

  #ctor: ShakaConstructor | null = null;
  readonly #controller = new ShakaController(this.video, this.ctx);

  /**
   * The `shaka-player` constructor.
   */
  get ctor() {
    return this.#ctor;
  }

  /**
   * The current `shaka-player` instance.
   */
  get instance() {
    return this.#controller.instance;
  }

  /**
   * Whether `shaka-player` is supported in this environment.
   */
  static supported = isHLSSupported() || isDASHSupported();

  override get type() {
    return 'shaka';
  }

  get canLiveSync() {
    return true;
  }

  #library: ShakaLibrary = `${JS_DELIVR_CDN}/npm/shaka-player@4.16.0/dist/shaka-player.compiled${
    __DEV__ ? '.debug.js' : '.js'
  }`;

  /**
   * The `shaka-player` configuration object.
   */
  get config() {
    return this.#controller.config;
  }

  set config(config) {
    this.#controller.config = config;
  }

  /**
   * The `shaka-player` constructor (supports dynamic imports) or a URL of where it can be found.
   *
   * @defaultValue `https://cdn.jsdelivr.net/npm/shaka-player@4.16.0/dist/shaka-player.compiled.js`
   */
  get library() {
    return this.#library;
  }

  set library(library) {
    this.#library = library;
  }

  preconnect(): void {
    if (!isString(this.#library)) return;
    preconnect(this.#library);
  }

  override setup() {
    super.setup();
    new ShakaLibLoader(this.#library, this.ctx, (ctor) => {
      this.#ctor = ctor;
      this.#controller.setup(ctor);
      this.ctx.notify('provider-setup', this);
      const src = peek(this.ctx.$state.source);
      if (src) this.loadSource(src);
    });
  }

  override async loadSource(src: Src, preload?: HTMLMediaElement['preload']) {
    if (!isString(src.src)) {
      this.removeSource();
      return;
    }

    this.media.preload = preload || '';
    this.appendSource(src as Src<string>);
    this.#controller.loadSource(src);
    this.currentSrc = src as Src<string>;
  }

  /**
   * The given callback is invoked when a new `hls.js` instance is created and right before it's
   * attached to media.
   */
  onInstance(callback: ShakaInstanceCallback): Dispose {
    const instance = this.#controller.instance;
    if (instance) callback(instance);
    return this.#controller.onInstance(callback);
  }

  destroy() {
    this.#controller.destroy();
  }
}
