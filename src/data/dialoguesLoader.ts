import type { DialogueDefinition } from '../types/game';
import { CATALOGUE_MANIFEST } from './catalogueManifest';
import type { CatalogLoadIssue } from './formatParser';
import { deepMergePlain, isPlainObject, parseRawGlobMap } from './globHelper';

function getRawModules(): Record<string, unknown> {
  try {
    return import.meta.glob(
      [
        './json/dialogues.{json,jsonc,toml}',
        './json/dialogues/*.{json,jsonc,toml}',
        './toml/dialogues.{json,jsonc,toml}',
        './toml/dialogues/*.{json,jsonc,toml}',
      ],
      { query: '?raw', import: 'default', eager: true }
    );
  } catch {
    return {};
  }
}

function mergeDialogue(
  out: Record<string, DialogueDefinition>,
  id: string,
  dlg: Partial<DialogueDefinition>
) {
  const prev = out[id];
  const merged = prev
    ? (deepMergePlain(
        prev as unknown as Record<string, unknown>,
        dlg as unknown as Record<string, unknown>
      ) as unknown as Partial<DialogueDefinition>)
    : dlg;
  if (!Array.isArray(merged.lines)) return;
  out[id] = { ...(merged as DialogueDefinition), id };
}

export function ingestDialoguesCatalog(
  raw: unknown,
  out: Record<string, DialogueDefinition>,
  fallbackId?: string
) {
  if (!raw || typeof raw !== 'object') return;

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (isPlainObject(item) && typeof item.id === 'string') {
        mergeDialogue(out, item.id, item as Partial<DialogueDefinition>);
      }
    }
    return;
  }

  const obj = raw as Record<string, unknown>;
  if (fallbackId && Array.isArray(obj.lines)) {
    const dlg = obj as Partial<DialogueDefinition>;
    mergeDialogue(out, dlg.id || fallbackId, dlg);
    return;
  }

  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('_')) continue;
    if (isPlainObject(val)) {
      const dlg = val as Partial<DialogueDefinition>;
      mergeDialogue(out, dlg.id || key, dlg);
    }
  }
}

export const DIALOGUE_LOAD_ISSUES: CatalogLoadIssue[] = [];

function parseDialoguesCatalog(): Record<string, DialogueDefinition> {
  const out: Record<string, DialogueDefinition> = {};
  const entries = parseRawGlobMap(getRawModules(), DIALOGUE_LOAD_ISSUES);
  for (const entry of entries) {
    const isFolder = entry.path.includes('/dialogues/');
    ingestDialoguesCatalog(entry.data, out, isFolder ? entry.slug : undefined);
  }
  if (CATALOGUE_MANIFEST.dialogues) {
    ingestDialoguesCatalog(CATALOGUE_MANIFEST.dialogues, out);
  }
  return out;
}

export const DIALOGUES_CATALOG: Record<string, DialogueDefinition> = parseDialoguesCatalog();
