import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestLevelsData } from './catalogLoaders.ts';
import {
  CatalogueManifestData,
  ingestCatalogueEntry,
  sortManifestEntries,
} from './catalogueManifest.ts';
import {
  CatalogLoadIssue,
  detectDataFormat,
  parseDataFile,
  parseDataTextAuto,
  stringifyToJson,
  stringifyToToml,
  stripJsonCommentsAndTrailingCommas,
} from './formatParser.ts';
import { parseRawGlobMap, sortDataEntriesByPriority } from './globHelper.ts';

test('stripJsonCommentsAndTrailingCommas removes BOM, comments, and trailing commas while preserving strings', () => {
  const raw = `\uFEFF{
    // single line comment
    "url": "https://scp-wiki.wikidot.com/*not-a-comment*/",
    /* multi
       line comment */
    "arr": [1, 2, 3,],
    "nested": { "ok": true, },
  }`;
  const cleaned = stripJsonCommentsAndTrailingCommas(raw);
  const parsed = JSON.parse(cleaned);
  assert.equal(parsed.url, 'https://scp-wiki.wikidot.com/*not-a-comment*/');
  assert.deepEqual(parsed.arr, [1, 2, 3]);
  assert.equal(parsed.nested.ok, true);
});

test('parseDataFile supports JSON, JSONC, and TOML + non-crashing diagnostics', () => {
  assert.equal(detectDataFormat('levels/1.json'), 'json');
  assert.equal(detectDataFormat('levels/1.jsonc'), 'jsonc');
  assert.equal(detectDataFormat('levels/1.toml'), 'toml');

  const jsonc = parseDataFile<{ hp: number }>('{\n // comment\n "hp": 250,\n}', 'scp.jsonc');
  assert.equal(jsonc.error, undefined);
  assert.equal(jsonc.format, 'jsonc');
  assert.equal(jsonc.data?.hp, 250);

  const toml = parseDataFile<{ title: string; waves: Array<{ delaySec: number }> }>(
    `title = "Sector TOML"\n[[waves]]\ndelaySec = 4\n`,
    'levels/4.toml'
  );
  assert.equal(toml.error, undefined);
  assert.equal(toml.format, 'toml');
  assert.equal(toml.data?.title, 'Sector TOML');
  assert.equal(toml.data?.waves[0].delaySec, 4);

  const invalid = parseDataFile('{ broken json', 'bad.json');
  assert.equal(invalid.data, null);
  assert.ok(invalid.error && invalid.error.length > 0);
});

test('parseDataTextAuto + stringifyToToml / stringifyToJson round-trip cleanly', () => {
  const payload = {
    title: 'Guardia Reforzado',
    tags: ['Personal', 'Defensa'],
    animation: { defaultState: 'attack', speed: 1.25 },
  };
  const tomlText = stringifyToToml(payload);
  const jsonText = stringifyToJson(payload);

  const fromToml = parseDataTextAuto<typeof payload>(tomlText, 'toml');
  assert.equal(fromToml.error, undefined);
  assert.deepEqual(fromToml.data, payload);

  const fromJson = parseDataTextAuto<typeof payload>(jsonText, 'json');
  assert.equal(fromJson.error, undefined);
  assert.deepEqual(fromJson.data, payload);
});

test('sortDataEntriesByPriority and parseRawGlobMap enforce json < jsonc < toml and record issues safely', () => {
  const sorted = sortDataEntriesByPriority([
    './toml/almanac.toml',
    './json/almanac.jsonc',
    './json/almanac.json',
    './toml/almanac/a.json',
  ]);
  assert.deepEqual(sorted, [
    './json/almanac.json',
    './json/almanac.jsonc',
    './toml/almanac/a.json',
    './toml/almanac.toml',
  ]);

  const issues: CatalogLoadIssue[] = [];
  const entries = parseRawGlobMap(
    {
      './json/ok.json': '{"value": 1,}',
      './toml/bad.toml': 'invalid = [unclosed',
      './toml/ok.toml': 'value = 2',
    },
    issues
  );
  assert.equal(entries.length, 2);
  assert.equal((entries[0].data as { value: number }).value, 1);
  assert.equal((entries[1].data as { value: number }).value, 2);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].file, './toml/bad.toml');
});

test('sortManifestEntries and ingestCatalogueEntry merge catalogue.toml sections with root priority', () => {
  const manifestOrder = sortManifestEntries([
    { path: './catalogue.toml', slug: 'catalogue', data: {} },
    { path: './json/catalogue.json', slug: 'catalogue', data: {} },
    { path: './catalogue/ui.toml', slug: 'ui', data: {} },
    { path: './toml/catalogue.toml', slug: 'catalogue', data: {} },
  ]);
  assert.deepEqual(
    manifestOrder.map((m) => m.path),
    [
      './catalogue/ui.toml',
      './json/catalogue.json',
      './toml/catalogue.toml',
      './catalogue.toml',
    ]
  );

  const out: CatalogueManifestData = {};
  ingestCatalogueEntry({ titleScreen: { title: 'Base UI' } }, out, 'ui');
  ingestCatalogueEntry(
    {
      ui: { titleScreen: { title: 'SITIO-19 CUSTOM' } },
      levels: { '1': { gameplayOverride: { energyDropAmount: 75 } } },
    },
    out
  );

  assert.equal((out.ui as { titleScreen: { title: string } }).titleScreen.title, 'SITIO-19 CUSTOM');

  const levelsMap = new Map();
  levelsMap.set(1, { level: 1, title: 'Original', startingEnergy: 100 });
  ingestLevelsData(out.levels, levelsMap);
  assert.equal(levelsMap.get(1).title, 'Original');
  assert.equal(levelsMap.get(1).gameplayOverride?.energyDropAmount, 75);
});
