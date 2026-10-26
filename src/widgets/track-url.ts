export type TrackProvider = 'spotify' | 'soundcloud';

export interface NormalizedTrack {
  provider: TrackProvider;
  canonical: string;
  embedUrl: string;
}

const MAX_RAW_LENGTH = 300;
const SPOTIFY_HOST = 'open.spotify.com';
const SOUNDCLOUD_HOSTS = new Set([
  'soundcloud.com',
  'www.soundcloud.com',
  'on.soundcloud.com',
]);
const SPOTIFY_PATH =
  /^\/(?:intl-[a-z]{2,3}(?:-[a-z0-9]{2,8})?\/)?(track|album|playlist)\/([A-Za-z0-9]{22})$/;
const SOUNDCLOUD_TRACK_PATH =
  /^\/([A-Za-z0-9_-]{1,64})\/(sets\/)?([A-Za-z0-9_-]{1,255})$/;
const SOUNDCLOUD_SHORT_PATH = /^\/([A-Za-z0-9_-]{1,32})$/;

// Only Spotify and SoundCloud over https. Host must match exactly, so
// lookalikes such as open.spotify.com.evil.com or evil.com/?u=open.spotify.com
// never pass. Query and hash are dropped; the canonical form is rebuilt.
export function normalizeTrackUrl(raw: string): NormalizedTrack | null {
  if (typeof raw !== 'string' || raw.length > MAX_RAW_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password || url.port) return null;

  const host = url.hostname.toLowerCase();

  if (host === SPOTIFY_HOST) {
    const match = SPOTIFY_PATH.exec(url.pathname);
    if (!match) return null;
    const [, type, id] = match;
    const canonical = `https://${SPOTIFY_HOST}/${type}/${id}`;
    return {
      provider: 'spotify',
      canonical,
      embedUrl: `https://${SPOTIFY_HOST}/embed/${type}/${id}?theme=0`,
    };
  }

  if (SOUNDCLOUD_HOSTS.has(host)) {
    if (host === 'on.soundcloud.com') {
      // Short links are stored as-is; no network resolution.
      const match = SOUNDCLOUD_SHORT_PATH.exec(url.pathname);
      if (!match) return null;
      const canonical = `https://on.soundcloud.com/${match[1]}`;
      return {
        provider: 'soundcloud',
        canonical,
        embedUrl: soundcloudEmbed(canonical),
      };
    }
    const match = SOUNDCLOUD_TRACK_PATH.exec(url.pathname);
    if (!match) return null;
    const [, user, sets, slug] = match;
    const canonical = `https://soundcloud.com/${user}/${sets ?? ''}${slug}`;
    return {
      provider: 'soundcloud',
      canonical,
      embedUrl: soundcloudEmbed(canonical),
    };
  }

  return null;
}

function soundcloudEmbed(canonical: string): string {
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(canonical)}&color=%23fa4d98&auto_play=false&visual=false`;
}
