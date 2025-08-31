export enum ShakaLibEventName {
  ABR_STATUS_CHANGED = 'abrstatuschanged',
  ERROR = 'error',
  TRACKS_CHANGED = 'trackschanged',
  LOADED = 'loaded',
  MANIFEST_UPDATED = 'manifestupdated',
  VARIANT_CHANGED = 'variantchanged',
  ADAPTATION = 'adaptation',
}

export interface ShakaLibEvents {
  [ShakaLibEventName.ABR_STATUS_CHANGED]: ShakaLibAbrStatusChangedEvent;
  [ShakaLibEventName.ERROR]: ShakaLibErrorEvent;
  [ShakaLibEventName.TRACKS_CHANGED]: ShakaLibTracksChangedEvent;
  [ShakaLibEventName.LOADED]: ShakaLibLoadedEvent;
  [ShakaLibEventName.MANIFEST_UPDATED]: ShakaLibManifestUpdatedEvent;
  [ShakaLibEventName.VARIANT_CHANGED]: ShakaLibVariantChangedEvent;
  [ShakaLibEventName.ADAPTATION]: ShakaLibAdaptationChangedEvent;
}
export interface ShakaLibAbrStatusChangedEvent {
  type: 'abrstatuschanged';
  newStatus: boolean;
}
export interface ShakaLibErrorEvent {
  type: 'error';
  detail: shaka.util.Error;
}
export interface ShakaLibTracksChangedEvent {
  type: 'trackschanged';
}
export interface ShakaLibLoadedEvent {
  type: 'loaded';
}
export interface ShakaLibManifestUpdatedEvent {
  type: 'manifestupdated';
  isLive: boolean;
}
export interface ShakaLibVariantChangedEvent {
  type: 'variantchanged';
  oldTrack: shaka.extern.Track | null;
  newTrack: shaka.extern.Track | null;
}

export interface ShakaLibAdaptationChangedEvent {
  type: 'adaptation';
  oldTrack: shaka.extern.Track | null;
  newTrack: shaka.extern.Track | null;
}
export type ShakaLibEventValues =
  | ShakaLibAbrStatusChangedEvent
  | ShakaLibErrorEvent
  | ShakaLibTracksChangedEvent
  | ShakaLibLoadedEvent
  | ShakaLibManifestUpdatedEvent
  | ShakaLibAdaptationChangedEvent;
