// Sharing the tank on the local network (Wi-Fi), when the user turns it on: a second server, apart from the one on
// 127.0.0.1, that only shows the tank. It serves the page and the feed and answers nothing else, so another device
// can't open sessions, change settings or reach the terminals. The feed is the user's session names and prompts, so
// it needs the secret key that's in the shared address.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { Share } from '../shared/types.ts';

type Request = http.IncomingMessage;
type Response = http.ServerResponse;

export interface SharingOptions {
  port: number;
  /** Where the key is kept, so a shared address keeps working after a restart; without it a new one each start. */
  keyFile?: string;
  subscribe: (request: Request, response: Response) => void;
  serveFile: (url: string, response: Response) => void;
  /** Called when sharing starts or fails, so the page can show the address or the problem. */
  onChange: () => void;
}

export const newShareKey = () => crypto.randomBytes(18).toString('base64url');

/** The saved key, or a new one saved for next time. */
export const readShareKey = (keyFile?: string) => {
  if (!keyFile) return newShareKey();
  try {
    const saved = fs.readFileSync(keyFile, 'utf8').trim();
    if (saved.length >= 16) return saved;
  } catch { /* none yet */ }
  const key = newShareKey();
  fs.mkdirSync(path.dirname(keyFile), { recursive: true });
  fs.writeFileSync(keyFile, key, { mode: 0o600 });
  return key;
};

// Networks that only exist inside this computer, for virtual machines and containers (Hyper-V and WSL, Docker,
// VirtualBox, VMware, Parallels, libvirt): no phone or TV can reach the tank there.
const VIRTUAL_ADAPTER = /^(vEthernet|VirtualBox|vboxnet|VMware|vmnet|vmenet|vnic|bridge\d|docker|br-|virbr|veth|lxcbr|lxdbr|podman|cni)/i;

/** This computer's addresses on the local network (IPv4, not loopback, not a virtual machine's network). */
export const lanAddresses = (interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces()) =>
  Object.entries(interfaces).filter(([name]) => !VIRTUAL_ADAPTER.test(name)).flatMap(([, addresses]) => addresses ?? [])
    .filter(address => address.family === 'IPv4' && !address.internal)
    .map(address => address.address);

export const shareUrls = (addresses: string[], port: number, key: string) =>
  addresses.map(address => `http://${address}:${port}/?key=${encodeURIComponent(key)}`);

/** Whether a request's address (path and query) carries the key. */
export const hasShareKey = (requestUrl: string, key: string) => {
  let given = '';
  try { given = new URL(requestUrl, 'http://share').searchParams.get('key') ?? ''; } catch { return false; }
  const givenBytes = Buffer.from(given), keyBytes = Buffer.from(key);
  return givenBytes.length === keyBytes.length && crypto.timingSafeEqual(givenBytes, keyBytes);
};

const refuse = (response: Response, status: number) => { response.writeHead(status); response.end(); };

/** Starts and stops the shared server as the setting changes; `share()` is what the page shows about it. */
export const createSharing = ({ port, keyFile, subscribe, serveFile, onChange }: SharingOptions) => {
  let server: http.Server | null = null, key = '', error = '';
  const handle = (request: Request, response: Response) => {
    const url = (request.url || '/').split('?')[0];
    if (request.method !== 'GET') { refuse(response, 405); request.resume(); return; }
    if (url !== '/events') { serveFile(url, response); return; }
    if (hasShareKey(request.url || '', key)) subscribe(request, response);
    else refuse(response, 403);
  };
  const start = () => {
    error = '';
    try { key ||= readShareKey(keyFile); } catch (problem) { error = String(problem); onChange(); return; }
    const starting = http.createServer(handle);
    server = starting;
    starting.once('error', (problem: NodeJS.ErrnoException) => {
      if (server === starting) server = null;
      error = problem.code === 'EADDRINUSE' ? `Port ${port} is already in use.` : String(problem);
      onChange();
    });
    starting.listen(port, '0.0.0.0', onChange);
  };
  const stop = () => {
    if (!server) return;
    server.close();
    server.closeAllConnections();
    server = null;
  };
  const update = (isOn: boolean) => {
    if (!isOn) { stop(); error = ''; return; }
    if (!server) start();
  };
  const share = (): Share | null => {
    if (error) return { urls: [], error };
    return server?.listening ? { urls: shareUrls(lanAddresses(), port, key) } : null;
  };
  return { update, share, stop };
};
