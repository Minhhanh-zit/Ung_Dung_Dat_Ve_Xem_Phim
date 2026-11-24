import {
  filterCoreCinemas,
  rankNearbyCinemas,
  cinemasFromNamedPlace,
  nearestIntent,
  directionsUrl,
  straightLineKm,
  type CinemaPosition,
} from '../src/cinehunt/cinemaNearest';

import {
  scopeWard,
  isCoreCinema,
  isCoreShowtime,
  sortScopeWards,
  CORE_CINEMA_WARDS,
} from '../src/cinehunt/cinemaScope';

import {
  PALETTES,
  DEFAULT_THEME_MODE,
  paletteFor,
  contrastRatio,
} from '../src/cinehunt/themeTokens';

const cinemas: CinemaPosition[] = [
  {
    cinemaId: 1,
    cinemaName: 'CineHunt Cầu Giấy',
    address: '11 Duy Tân',
    city: 'Hà Nội',
    latitude: 21.0309,
    longitude: 105.7828,
    status: 'ACTIVE',
  },
  {
    cinemaId: 2,
    cinemaName: 'CineHunt Hà Đông',
    address: '2 Trần Phú',
    city: 'Hà Nội',
    latitude: 20.9801,
    longitude: 105.7909,
    status: 'ACTIVE',
  },
  {
    cinemaId: 3,
    cinemaName: 'CineHunt Thanh Xuân',
    address: '2 Lê Văn Thiêm',
    city: 'Hà Nội',
    latitude: 21.0022,
    longitude: 105.80277,
    status: 'ACTIVE',
  },
  {
    cinemaId: 4,
    cinemaName: 'CineHunt Aeon Long Biên',
    address: '27 Cổ Linh',
    city: 'Hà Nội',
    latitude: 21.0466,
    longitude: 105.8935,
    status: 'ACTIVE',
  },
];

describe('Cinema nearest production coverage', () => {
  test('only returns the three core cinemas', () => {
    expect(filterCoreCinemas(cinemas)).toHaveLength(3);
  });

  test('removes inactive, unknown and duplicated cinemas', () => {
    const rows = [
      ...cinemas.slice(0, 3),
      { ...cinemas[0], cinemaId: 10 },
      { ...cinemas[1], status: 'INACTIVE' },
    ];

    expect(filterCoreCinemas(rows).map(x => x.cinemaName)).toHaveLength(3);
  });

  test('handles invalid input', () => {
    expect(filterCoreCinemas(null as never)).toEqual([]);
  });

  test('ranks cinemas by straight-line distance', () => {
    const result = rankNearbyCinemas(cinemas, {
      latitude: 21.002,
      longitude: 105.802,
    });

    expect(result).toHaveLength(3);
    expect(result[0].cinemaName).toBe('CineHunt Thanh Xuân');
    expect(result[0].straightLineKm).toBeLessThan(
      result[1].straightLineKm!
    );
  });

  test('rejects invalid GPS coordinates', () => {
    expect(
      rankNearbyCinemas(cinemas, {
        latitude: 200,
        longitude: 105,
      })
    ).toEqual([]);
  });

  test('keeps missing cinema coordinates as null distance', () => {
    const result = rankNearbyCinemas(
      [{ ...cinemas[0], latitude: null }],
      { latitude: 21, longitude: 105 }
    );

    expect(result[0].straightLineKm).toBeNull();
  });

  test('calculates straight-line distance', () => {
    expect(
      straightLineKm(
        { latitude: 21, longitude: 105 },
        { latitude: 21, longitude: 105 }
      )
    ).toBe(0);
  });

  test('builds Google Maps driving URL', () => {
    const url = directionsUrl(cinemas[0], {
      latitude: 21,
      longitude: 105,
    });

    expect(url).toContain('travelmode=driving');
    expect(url).toContain('origin=');
  });

  test('supports named origin', () => {
    const url = directionsUrl(cinemas[0], 'Tân Mai, Hà Nội');

    expect(decodeURIComponent(url)).toContain('Tân Mai');
  });

  test('does not create origin from invalid coordinates', () => {
    const url = directionsUrl(cinemas[0], {
      latitude: 200,
      longitude: 105,
    });

    expect(url).not.toContain('origin=');
  });

  test('uses demo venue address for Thanh Xuan', () => {
    const url = directionsUrl(cinemas[2]);

    expect(decodeURIComponent(url)).toContain('Beta Cinemas');
  });

  test('named place search does not invent GPS distance', () => {
    const result = cinemasFromNamedPlace(cinemas, 'Tân Mai, Hà Nội');

    expect(result).toHaveLength(3);
    expect(result.every(x => x.straightLineKm === null)).toBe(true);
  });

  test('detects GPS nearest cinema intent', () => {
    expect(nearestIntent('Tìm rạp gần tôi')).toEqual({
      kind: 'gps',
    });
  });

  test('detects named location intent', () => {
    expect(nearestIntent('Tìm rạp gần Tân Mai cho tôi')).toEqual({
      kind: 'named',
      origin: 'Phường Tân Mai, Hà Nội, Việt Nam',
    });
  });

  test('ignores unrelated messages', () => {
    expect(nearestIntent('Hôm nay có phim nào hay?')).toBeNull();
  });
});

describe('Cinema scope production coverage', () => {
  test('defines exactly three pilot cinemas', () => {
    expect(CORE_CINEMA_WARDS).toHaveLength(3);
  });

  test('resolves cinema ward', () => {
    expect(scopeWard({ cinemaName: 'CineHunt Thanh Xuân' }))
      .toBe('Phường Thanh Xuân');
  });

  test('normalizes cinema name', () => {
    expect(scopeWard({ cinemaName: 'CINEHUNT CẦU GIẤY' }))
      .toBe('Phường Cầu Giấy');
  });

  test('returns null for unknown cinema', () => {
    expect(scopeWard({ cinemaName: 'Unknown' })).toBeNull();
    expect(scopeWard({ cinemaName: null })).toBeNull();
  });

  test('checks core cinema membership', () => {
    expect(isCoreCinema({ cinemaName: 'CineHunt Hà Đông' })).toBe(true);
    expect(isCoreCinema({ cinemaName: 'Unknown' })).toBe(false);
  });

  test('checks core showtime membership', () => {
    expect(
      isCoreShowtime({
        room: {
          cinema: { cinemaName: 'CineHunt Hà Đông' },
        },
      } as never)
    ).toBe(true);

    expect(
      isCoreShowtime({
        room: {
          cinema: { cinemaName: 'Unknown' },
        },
      } as never)
    ).toBe(false);
  });

  test('sorts pilot wards in configured order', () => {
    expect(
      sortScopeWards('Phường Thanh Xuân', 'Phường Hà Đông')
    ).toBeLessThan(0);

    expect(
      sortScopeWards('Phường Hà Đông', 'Phường Cầu Giấy')
    ).toBeLessThan(0);
  });

  test('unknown wards sort after pilot wards', () => {
    expect(
      sortScopeWards('Unknown', 'Phường Thanh Xuân')
    ).toBeGreaterThan(0);
  });
});

describe('Theme token production coverage', () => {
  test('defaults to light theme', () => {
    expect(DEFAULT_THEME_MODE).toBe('light');
  });

  test('provides light and dark palettes', () => {
    expect(PALETTES.light).toBeDefined();
    expect(PALETTES.dark).toBeDefined();
  });

  test('both themes expose identical tokens', () => {
    expect(Object.keys(PALETTES.light).sort()).toEqual(
      Object.keys(PALETTES.dark).sort()
    );
  });

  test('resolves the correct palette', () => {
    expect(paletteFor('light')).toBe(PALETTES.light);
    expect(paletteFor('dark')).toBe(PALETTES.dark);
  });

  test('semantic aliases map to base colors', () => {
    expect(PALETTES.light.background).toBe(PALETTES.light.bg);
    expect(PALETTES.dark.surface).toBe(PALETTES.dark.panel);
    expect(PALETTES.dark.textPrimary).toBe(PALETTES.dark.white);
  });

  test('calculates maximum contrast', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  test('calculates minimum contrast', () => {
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
  });

  test('contrast is symmetric', () => {
    expect(
      contrastRatio('#336699', '#FFFFFF')
    ).toBeCloseTo(
      contrastRatio('#FFFFFF', '#336699'),
      8
    );
  });
});
