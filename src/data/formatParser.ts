import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';

export type DataFileFormat = 'json' | 'jsonc' | 'toml';

export interface DataParseResult<T = unknown> {
  data: T | null;
  format: DataFileFormat;
  error?: string;
}

export interface CatalogLoadIssue {
  file: string;
  format: DataFileFormat;
  message: string;
}

export function detectDataFormat(filePath: string): DataFileFormat {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.toml')) return 'toml';
  if (lower.endsWith('.jsonc')) return 'jsonc';
  return 'json';
}

/**
 * Strips UTF-8 BOM, // single-line comments, /* multi-line comments *\/,
 * and trailing commas outside quoted strings so standard JSON and relaxed JSON/JSONC
 * both parse cleanly.
 */
export function stripJsonCommentsAndTrailingCommas(input: string): string {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  let withoutComments = '';
  let i = 0;
  let inString = false;
  let escaped = false;

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (inString) {
      withoutComments += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }

    if (ch === '"') {
      inString = true;
      withoutComments += ch;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '/') {
      i += 2;
      while (i < text.length && text[i] !== '\n' && text[i] !== '\r') {
        i += 1;
      }
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        if (text[i] === '\n') withoutComments += '\n';
        i += 1;
      }
      i += 2;
      continue;
    }

    withoutComments += ch;
    i += 1;
  }

  // Pass 2: remove trailing commas before } or ] outside strings
  let out = '';
  inString = false;
  escaped = false;
  for (let j = 0; j < withoutComments.length; j++) {
    const ch = withoutComments[j];
    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ',') {
      let k = j + 1;
      while (k < withoutComments.length && /\s/.test(withoutComments[k])) {
        k += 1;
      }
      if (withoutComments[k] === '}' || withoutComments[k] === ']') {
        continue;
      }
    }
    out += ch;
  }

  return out;
}

function normalizeTomlValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map(normalizeTomlValue);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = normalizeTomlValue(v);
      }
    }
    return out;
  }
  return value;
}

export function stripUndefinedDeep(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      const cleaned = stripUndefinedDeep(v);
      if (cleaned !== undefined) {
        out[k] = cleaned;
      }
    }
    return out;
  }
  return value;
}

export function parseDataFile<T = unknown>(rawText: string, filePath: string): DataParseResult<T> {
  const format = detectDataFormat(filePath);
  try {
    if (format === 'toml') {
      const parsed = parseToml(rawText);
      return {
        data: normalizeTomlValue(parsed) as T,
        format,
      };
    }
    const cleaned = stripJsonCommentsAndTrailingCommas(rawText);
    const parsed = JSON.parse(cleaned);
    return {
      data: parsed as T,
      format,
    };
  } catch (err) {
    return {
      data: null,
      format,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function parseDataTextAuto<T = unknown>(
  rawText: string,
  preferredFormat?: 'json' | 'toml'
): DataParseResult<T> {
  const trimmed = rawText.trim();
  const looksLikeJson =
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*');

  const tryOrder: DataFileFormat[] =
    preferredFormat === 'toml' && !looksLikeJson
      ? ['toml', 'jsonc']
      : preferredFormat === 'json' || looksLikeJson
      ? ['jsonc', 'toml']
      : ['toml', 'jsonc'];

  let firstError = '';
  for (const fmt of tryOrder) {
    const fakePath = fmt === 'toml' ? 'input.toml' : 'input.jsonc';
    const res = parseDataFile<T>(rawText, fakePath);
    if (!res.error && res.data !== null) {
      return res;
    }
    if (!firstError && res.error) {
      firstError = res.error;
    }
  }

  return {
    data: null,
    format: tryOrder[0],
    error: firstError || 'Formato JSON/TOML inválido',
  };
}

export function stringifyToJson(value: unknown, indent = 2): string {
  return JSON.stringify(stripUndefinedDeep(value), null, indent);
}

export function stringifyToToml(value: unknown): string {
  const cleaned = stripUndefinedDeep(value);
  if (!cleaned || typeof cleaned !== 'object' || Array.isArray(cleaned)) {
    throw new Error('La raíz de un archivo TOML debe ser una tabla/objeto.');
  }
  return stringifyToml(cleaned as Record<string, unknown>);
}

export function stripDataExtension(path: string): string {
  const base = path.split('/').pop() ?? '';
  return base.replace(/\.(jsonc?|toml)$/i, '');
}

export function formatPriority(path: string): number {
  const lower = path.toLowerCase();
  if (lower.endsWith('.toml')) return 2;
  if (lower.endsWith('.jsonc')) return 1;
  return 0;
}
