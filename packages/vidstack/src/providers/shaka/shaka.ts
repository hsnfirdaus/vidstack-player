import { peek } from 'maverick.js';
import { camelToKebabCase, DOMEvent, isString, listenEvent } from 'maverick.js/std';

import type { MediaContext } from '../../core/api/media-context';
import type { Src } from '../../core/api/src-types';
import { QualitySymbol } from '../../core/quality/symbols';
import { ListSymbol } from '../../foundation/list/symbols';
import {
  ShakaLibEventName,
  type ShakaLibErrorEvent,
  type ShakaLibEventValues,
  type ShakaLibManifestUpdatedEvent,
  type ShakaLibVariantChangedEvent,
} from './events';
import type { ShakaConstructor, ShakaInstanceCallback } from './types';

const toDOMEventType = (type: string) => `shaka-${camelToKebabCase(type)}`;

export class ShakaController {
  #video: HTMLVideoElement;
  #ctx: MediaContext;

  #instance: shaka.Player | null = null;
  #eventManager: shaka.util.EventManager | null = null;
  #callbacks = new Set<ShakaInstanceCallback>();
  #stopLiveSync: (() => void) | null = null;

  config: Partial<shaka.extern.PlayerConfiguration> = {};

  get instance() {
    return this.#instance;
  }

  constructor(video: HTMLVideoElement, ctx: MediaContext) {
    this.#video = video;
    this.#ctx = ctx;
  }

  setup(ctor: ShakaConstructor) {
    shaka.polyfill.installAll();
    this.#instance = new ctor();

    const dispatcher = this.#dispatchShakaEvent.bind(this);
    this.#eventManager = new shaka.util.EventManager();
    for (const event of Object.values(ShakaLibEventName))
      this.#eventManager.listen(this.#instance, event, dispatcher);

    this.#eventManager.listen(this.#instance, ShakaLibEventName.ERROR, this.#onError.bind(this));
    for (const callback of this.#callbacks) callback(this.#instance);

    this.#instance.attach(this.#video);

    this.#ctx.player.dispatch('shaka-instance' as any, {
      detail: this.#instance,
    });

    this.#instance.configure({
      ...this.config,
    });

    this.#eventManager.listen(
      this.#instance,
      ShakaLibEventName.MANIFEST_UPDATED,
      this.#onManifestUpdated.bind(this),
    );
    this.#eventManager.listen(this.#instance, ShakaLibEventName.LOADED, this.#onLoaded.bind(this));
    this.#eventManager.listen(
      this.#instance,
      ShakaLibEventName.TRACKS_CHANGED,
      this.#onTracksChanged.bind(this),
    );
    this.#eventManager.listen(
      this.#instance,
      ShakaLibEventName.VARIANT_CHANGED,
      this.#onVariantChanged.bind(this),
    );
    this.#eventManager.listen(
      this.#instance,
      ShakaLibEventName.ADAPTATION,
      this.#onVariantChanged.bind(this),
    );

    this.#ctx.qualities[QualitySymbol.enableAuto] = this.#enableAutoQuality.bind(this);

    listenEvent(this.#ctx.qualities, 'change', this.#onUserQualityChange.bind(this));
  }

  #createDOMEvent(value: ShakaLibEventValues) {
    return new DOMEvent<ShakaLibEventValues>(toDOMEventType(value.type), {
      detail: value as never,
    });
  }

  #dispatchShakaEvent(value: any) {
    this.#ctx.player?.dispatch(this.#createDOMEvent(value));
  }

  #onError(event: any) {
    const { type: eventType, detail: data } = event as ShakaLibErrorEvent;

    if (__DEV__) {
      this.#ctx.logger
        ?.errorGroup(`[vidstack] Shaka error \`${data.message}\``)
        .labelledLog('Media Element', this.#video)
        .labelledLog('Shaka Instance', this.#instance)
        .labelledLog('Event Type', eventType)
        .labelledLog('Data', data)
        .labelledLog('Src', peek(this.#ctx.$state.source))
        .labelledLog('Media Store', { ...this.#ctx.$state })
        .dispatch();
    }
  }

  #onManifestUpdated(event: any) {
    const { isLive } = event as ShakaLibManifestUpdatedEvent;
    const trigger = this.#createDOMEvent(event);
    this.#ctx.qualities[QualitySymbol.setAuto](true, trigger);

    this.#ctx.notify('stream-type-change', isLive ? 'live' : 'on-demand', trigger);
  }

  #onLoaded(event: any) {
    if (this.#ctx.$state.canPlay() || !this.#instance) return;

    const trigger = this.#createDOMEvent(event);

    const media = this.#instance.getMediaElement();
    media?.dispatchEvent(new DOMEvent<void>('canplay', { trigger }));
  }

  #onTracksChanged(event: any) {
    const variants = this.#instance!.getVariantTracks();
    const trigger = this.#createDOMEvent(event);

    variants
      .filter((item) => item.height !== null)
      .forEach((item, index) => {
        const quality = {
          id: item.id?.toString() ?? `dash-bitrate-${index}`,
          width: item.width ?? 0,
          height: item.height ?? 0,
          bitrate: item.bandwidth ?? 0,
          codec: item.videoCodec,
          index,
        };

        this.#ctx.qualities[ListSymbol.add](quality, trigger);
      });
  }

  #onVariantChanged(event: any) {
    const { newTrack } = event as ShakaLibVariantChangedEvent;
    if (newTrack) {
      const quality = this.#ctx.qualities.getById(newTrack.id.toString());
      const trigger = this.#createDOMEvent(event);
      this.#ctx.qualities[ListSymbol.select](quality!, true, trigger);
    }
  }

  #onUserQualityChange() {
    const { qualities } = this.#ctx;

    if (!this.#instance || qualities.auto || !qualities.selected) return;

    this.#disableAutoQuality();

    const track = this.#instance
      .getVariantTracks()
      .find((t) => t.id?.toString() === qualities.selected?.id);
    if (!track) return;
    this.#instance.selectVariantTrack(track);
  }

  #enableAutoQuality() {
    this.#instance?.configure({
      abr: {
        enabled: true,
      },
    });
  }
  #disableAutoQuality() {
    this.#instance?.configure({
      abr: {
        enabled: false,
      },
    });
  }

  onInstance(callback: ShakaInstanceCallback) {
    this.#callbacks.add(callback);
    return () => this.#callbacks.delete(callback);
  }

  loadSource(src: Src) {
    if (!isString(src.src)) return;
    this.#instance?.load(src.src);
  }

  destroy() {
    this.#instance?.destroy();
    this.#instance = null;
    this.#stopLiveSync?.();
    this.#stopLiveSync = null;
    if (__DEV__) this.#ctx?.logger?.info('🏗️ Destroyed Shaka instance');
  }
}
