// Turns a tool call (Claude Code's hooks, Copilot's events) into a few words: "Editing reef.ts", "run npm test".
import path from 'node:path';
import { isRecord } from './session.ts';

interface Verb { ing: string; base: string; fields: string[] }

const EDIT: Verb = { ing: 'Editing', base: 'edit', fields: ['file_path', 'path', 'notebook_path'] };
const READ: Verb = { ing: 'Reading', base: 'read', fields: ['file_path', 'path'] };
const RUN: Verb = { ing: 'Running', base: 'run', fields: ['command'] };
const SEARCH: Verb = { ing: 'Searching', base: 'search', fields: ['pattern', 'query'] };
const FETCH: Verb = { ing: 'Fetching', base: 'fetch', fields: ['url'] };
const DELEGATE: Verb = { ing: 'Running', base: 'run', fields: ['description'] };

// Claude Code's tool names and Copilot's, lower case.
const VERBS: Record<string, Verb> = {
  edit: EDIT, write: EDIT, multiedit: EDIT, notebookedit: EDIT, create: EDIT, str_replace_editor: EDIT,
  read: READ, view: READ,
  bash: RUN, powershell: RUN,
  grep: SEARCH, glob: SEARCH, websearch: SEARCH,
  webfetch: FETCH, web_fetch: FETCH,
  agent: DELEGATE, task: DELEGATE,
};

const MAX_TARGET = 40;
const FILE_FIELDS = new Set(['file_path', 'path', 'notebook_path']);

const clip = (text: string) => {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > MAX_TARGET ? line.slice(0, MAX_TARGET - 1) + '…' : line;
};

const hostOf = (url: string) => {
  try { return new URL(url).host; } catch { return clip(url); }
};

const targetOf = (verb: Verb, input: Record<string, unknown>) => {
  for (const field of verb.fields) {
    const text = input[field];
    if (typeof text !== 'string' || !text) continue;
    if (FILE_FIELDS.has(field)) return path.basename(text.replace(/\\/g, '/'));
    return field === 'url' ? hostOf(text) : clip(text);
  }
  return '';
};

const verbOf = (toolName: string): Verb | undefined => {
  const key = toolName.toLowerCase();
  return Object.hasOwn(VERBS, key) ? VERBS[key] : undefined;
};

/** What a tool call is doing: "Editing reef.ts", "Running npm test"; the tool's name when it isn't one we know. */
export const activityOf = (toolName: string, input: unknown) => {
  const verb = verbOf(toolName);
  if (!verb) return toolName ? `Using ${toolName}` : '';
  const target = targetOf(verb, isRecord(input) ? input : {});
  return target ? `${verb.ing} ${target}` : verb.ing;
};

/** What a tool call asks to do, for a permission prompt: "run rm -rf dist", "edit reef.ts"; empty without a target. */
export const requestOf = (toolName: string, input: unknown) => {
  const verb = verbOf(toolName);
  if (!verb) return toolName ? `use ${toolName}` : '';
  const target = targetOf(verb, isRecord(input) ? input : {});
  return target ? `${verb.base} ${target}` : '';
};
