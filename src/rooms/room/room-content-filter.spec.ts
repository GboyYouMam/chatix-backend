import { classifyRoomText } from './room-content-filter';

describe('classifyRoomText', () => {
  it.each([
    ['child porn trade', 'child porn'],
    ['cheap fullz for sale', 'fullz'],
    ['buy coke here', 'buy coke'],
    ['selling weed in bulk', 'selling weed'],
    ['hire a hitman for my ex', 'hitman'],
    ['ghost gun kits', 'ghost gun'],
  ])('blocks "%s"', (text, matched) => {
    expect(classifyRoomText(text)).toEqual({ verdict: 'blocked', matched });
  });

  it('blocks leetspeak trade talk', () => {
    expect(classifyRoomText('s3lling w33d')).toEqual({
      verdict: 'blocked',
      matched: 'selling weed',
    });
  });

  it('marks legal adult talk as mature', () => {
    expect(classifyRoomText('weed growing tips').verdict).toBe('mature');
    expect(classifyRoomText('nsfw corner', 'no minors').verdict).toBe('mature');
  });

  it('does not flag harmless words that contain filtered substrings', () => {
    expect(classifyRoomText('class schedule')).toEqual({
      verdict: 'ok',
      matched: null,
    });
    expect(classifyRoomText('scrape data', 'cocktail recipes')).toEqual({
      verdict: 'ok',
      matched: null,
    });
  });

  it('lets blocked terms win over mature ones', () => {
    expect(classifyRoomText('weed talk', 'buy coke here')).toEqual({
      verdict: 'blocked',
      matched: 'buy coke',
    });
  });
});
