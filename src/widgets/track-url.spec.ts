import { normalizeTrackUrl } from './track-url';

describe('normalizeTrackUrl', () => {
  it.each([
    'https://open.spotify.com.evil.com/track/4uLU6hMCjMI75M1A2tKUQC',
    'https://open.spotify.com@evil.com/track/4uLU6hMCjMI75M1A2tKUQC',
    'https://evil.com/?u=open.spotify.com',
    'https://evil.com/track/4uLU6hMCjMI75M1A2tKUQC?x=open.spotify.com',
    'https://evil-open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
    'http://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
    'javascript:alert(1)',
    'javascript://open.spotify.com/%0aalert(1)',
    'data:text/html,open.spotify.com',
    'https://open.spotify.com:8443/track/4uLU6hMCjMI75M1A2tKUQC',
    'https://open.spotify.com/search/some%20song',
    'https://open.spotify.com/user/someone',
    'https://soundcloud.com.evil.com/artist/track',
    'https://evil.com/artist/track?u=soundcloud.com',
    'https://soundcloud.com/artist',
    'not a url',
    '',
  ])('rejects %s', (raw) => {
    expect(normalizeTrackUrl(raw)).toBeNull();
  });

  it('rejects oversized input', () => {
    expect(
      normalizeTrackUrl(`https://soundcloud.com/a/${'b'.repeat(400)}`),
    ).toBeNull();
  });

  it('builds the spotify embed for track, album and playlist links', () => {
    expect(
      normalizeTrackUrl(
        'https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC?si=abc#x',
      ),
    ).toEqual({
      provider: 'spotify',
      canonical: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
      embedUrl:
        'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC?theme=0',
    });
    expect(
      normalizeTrackUrl('https://open.spotify.com/album/1A2tKUQC4uLU6hMCjMI75M')
        ?.embedUrl,
    ).toBe(
      'https://open.spotify.com/embed/album/1A2tKUQC4uLU6hMCjMI75M?theme=0',
    );
    expect(
      normalizeTrackUrl(
        'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
      )?.provider,
    ).toBe('spotify');
  });

  it('builds the soundcloud embed for track and set links', () => {
    const track = normalizeTrackUrl(
      'https://www.soundcloud.com/some-artist/my_track?utm=1',
    );
    expect(track).toEqual({
      provider: 'soundcloud',
      canonical: 'https://soundcloud.com/some-artist/my_track',
      embedUrl:
        'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fsome-artist%2Fmy_track&color=%23fa4d98&auto_play=false&visual=false',
    });
    expect(
      normalizeTrackUrl('https://soundcloud.com/some-artist/sets/mixtape')
        ?.canonical,
    ).toBe('https://soundcloud.com/some-artist/sets/mixtape');
  });

  it('keeps short soundcloud links as-is', () => {
    expect(normalizeTrackUrl('https://on.soundcloud.com/AbCd12')).toEqual({
      provider: 'soundcloud',
      canonical: 'https://on.soundcloud.com/AbCd12',
      embedUrl:
        'https://w.soundcloud.com/player/?url=https%3A%2F%2Fon.soundcloud.com%2FAbCd12&color=%23fa4d98&auto_play=false&visual=false',
    });
  });
});
