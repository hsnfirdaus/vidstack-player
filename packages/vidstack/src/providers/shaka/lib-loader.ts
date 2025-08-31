import { DOMEvent, isFunction, isString, isUndefined } from 'maverick.js/std';

import type { MediaContext } from '../../core/api/media-context';
import { coerceToError } from '../../utils/error';
import { loadScript } from '../../utils/network';
import type {
  ShakaConstructor,
  ShakaConstructorLoader,
  ShakaLibrary,
  ShakaNamespace,
  ShakaNamespaceLoader,
} from './types';

interface LoadShakaConstructorCallbacks {
  onLoadStart?: () => void;
  onLoaded?: (ctor: ShakaConstructor) => void;
  onLoadError?: (err: Error) => void;
}

export class ShakaLibLoader {
  #lib: ShakaLibrary;
  #ctx: MediaContext;
  #callback: (ctor: ShakaConstructor) => void;

  constructor(lib: ShakaLibrary, ctx: MediaContext, callback: (ctor: ShakaConstructor) => void) {
    this.#lib = lib;
    this.#ctx = ctx;
    this.#callback = callback;
    this.#startLoading();
  }

  async #startLoading() {
    if (__DEV__) this.#ctx.logger?.info('🏗️ Loading Shaka Library');

    const callbacks: LoadShakaConstructorCallbacks = {
      onLoadStart: this.#onLoadStart.bind(this),
      onLoaded: this.#onLoaded.bind(this),
      onLoadError: this.#onLoadError.bind(this),
    };

    // If not a string it'll return undefined.
    let ctor = await loadShakaScript(this.#lib, callbacks);

    // If it's not a remote source, it must of been passed in directly as a static/dynamic import.
    if (isUndefined(ctor) && !isString(this.#lib)) ctor = await importShaka(this.#lib, callbacks);

    // We failed loading the constructor.
    if (!ctor) return null;

    // Not supported.
    if (!window.shaka.Player.isBrowserSupported()) {
      const message = '[vidstack] `shaka-player` is not supported in this environment';
      if (__DEV__) this.#ctx.logger?.error(message);
      this.#ctx.player.dispatch(new DOMEvent<void>('shaka-unsupported'));
      this.#ctx.notify('error', { message, code: 4 });
      return null;
    }

    return ctor;
  }

  #onLoadStart() {
    if (__DEV__) {
      this.#ctx.logger
        ?.infoGroup('Starting to load `shaka-player`')
        .labelledLog('URL', this.#lib)
        .dispatch();
    }

    this.#ctx.player.dispatch(new DOMEvent<void>('shaka-lib-load-start'));
  }

  #onLoaded(ctor: ShakaConstructor) {
    if (__DEV__) {
      this.#ctx.logger
        ?.infoGroup('Loaded `shaka-player`')
        .labelledLog('Library', this.#lib)
        .labelledLog('Constructor', ctor)
        .dispatch();
    }

    this.#ctx.player.dispatch(
      new DOMEvent<ShakaConstructor>('shaka-lib-loaded', {
        detail: ctor,
      }),
    );

    this.#callback(ctor);
  }

  #onLoadError(e: any) {
    const error = coerceToError(e);

    if (__DEV__) {
      this.#ctx.logger
        ?.errorGroup('[vidstack] Failed to load `shaka-player`')
        .labelledLog('Library', this.#lib)
        .labelledLog('Error', e)
        .dispatch();
    }

    this.#ctx.player.dispatch(
      new DOMEvent<any>('shaka-lib-load-error', {
        detail: error,
      }),
    );

    this.#ctx.notify('error', {
      message: error.message,
      code: 4,
      error,
    });
  }
}

async function importShaka(
  loader:
    | ShakaConstructor
    | ShakaConstructorLoader
    | ShakaNamespace
    | ShakaNamespaceLoader
    | undefined,
  callbacks: LoadShakaConstructorCallbacks = {},
) {
  if (isUndefined(loader)) return undefined;

  callbacks.onLoadStart?.();

  if (isShakaConstructor(loader)) {
    callbacks.onLoaded?.(loader);
    return loader;
  }

  if (isShakaNamespace(loader)) {
    const ctor = loader.Player;
    callbacks.onLoaded?.(ctor);
    return ctor;
  }

  try {
    const ctor = (await loader())?.default;

    if (isShakaNamespace(ctor)) {
      callbacks.onLoaded?.(ctor.Player);
      return ctor.Player;
    }

    if (ctor) {
      callbacks.onLoaded?.(ctor);
    } else {
      throw Error(
        __DEV__
          ? '[vidstack] failed importing `shaka-player`. Dynamic import returned invalid object.'
          : '',
      );
    }

    return ctor;
  } catch (err) {
    callbacks.onLoadError?.(err as Error);
  }

  return undefined;
}

/**
 * Loads `shaka-player` from the remote source given via `library` into the window namespace
 */
async function loadShakaScript(
  src: unknown,
  callbacks: LoadShakaConstructorCallbacks = {},
): Promise<ShakaConstructor | undefined> {
  if (!isString(src)) return undefined;

  callbacks.onLoadStart?.();

  try {
    await loadScript(src);

    if (!isFunction((window as any).shaka.Player)) {
      throw Error(
        __DEV__
          ? '[vidstack] failed loading `shaka-player`. Could not find a valid `Shaka` constructor on window'
          : '',
      );
    }

    const ctor = window.shaka.Player;
    callbacks.onLoaded?.(ctor);
    return ctor;
  } catch (err) {
    callbacks.onLoadError?.(err as Error);
  }

  return undefined;
}

function isShakaConstructor(value: any): value is ShakaConstructor {
  return value && value.prototype && value.prototype !== Function;
}

function isShakaNamespace(value: any): value is ShakaNamespace {
  return value && 'Player' in value;
}
