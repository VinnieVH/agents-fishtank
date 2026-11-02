// The built-in terminals: what the app's preload (electron/preload.ts) gives the page as window.fishtankTerminals.
// The shells run in the app (electron/terminals.ts); the page only shows them. Not there in the browser version.

/** What a new tab runs: an agent CLI (left in a shell when it ends) or just a shell. */
export type TerminalKind = 'claude' | 'copilot' | 'shell';

export interface Tab { id: number; kind: TerminalKind; folder: string }

export interface TerminalSetup {
  /** The menu's names for each kind, e.g. the shell's "PowerShell". */
  kinds: { kind: TerminalKind; name: string }[];
  /** Where new tabs start. */
  folder: string;
  /** Whether the terminal side was open last time, and how wide it was (px). */
  open: boolean;
  width: number;
  /** The tabs already running, after the page was reloaded. */
  tabs: Tab[];
}

export interface TerminalsApi {
  setup(): Promise<TerminalSetup>;
  /** Starts a tab in the folder new tabs start in. */
  create(kind: TerminalKind, cols: number, rows: number): Promise<Tab>;
  write(id: number, data: string): void;
  resize(id: number, cols: number, rows: number): void;
  kill(id: number): void;
  /** Asks for the folder new tabs start in; resolves to it, unchanged if the dialog was cancelled. */
  pickFolder(): Promise<string>;
  /** Remembers the terminal side's layout for next time. */
  layout(open: boolean, width: number): void;
  copy(text: string): void;
  paste(): Promise<string>;
  onData(listener: (id: number, data: string) => void): void;
  onExit(listener: (id: number) => void): void;
  /** View > Terminal in the app's menu. */
  onToggle(listener: () => void): void;
}
