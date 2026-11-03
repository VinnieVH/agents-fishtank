import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { hasShareKey, lanAddresses, readShareKey, shareUrls } from '../server/share';
import { startServer, type Fishtank } from '../server/server';

const PORT = 47391, SHARE_PORT = 47392;

const tempFolder = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-share-'));

const request = (url: string, method = 'GET') => new Promise<{ status: number; firstData: string }>((resolve, reject) => {
  const sent = http.request(url, { method }, response => {
    if (response.statusCode !== 200 || !response.headers['content-type']?.startsWith('text/event-stream')) {
      response.resume();
      resolve({ status: response.statusCode ?? 0, firstData: '' });
      return;
    }
    response.once('data', (chunk: Buffer) => { resolve({ status: 200, firstData: chunk.toString() }); sent.destroy(); });
  });
  sent.on('error', reject);
  sent.end();
});

describe('share helpers', () => {
  it('lists only the IPv4 addresses on a network', () => {
    const base = { netmask: '', mac: '', cidr: null };
    expect(lanAddresses({
      loopback: [{ ...base, address: '127.0.0.1', family: 'IPv4', internal: true }],
      wifi: [{ ...base, address: '192.168.1.20', family: 'IPv4', internal: false }, { ...base, address: 'fe80::1', family: 'IPv6', internal: false, scopeid: 1 }],
      down: undefined,
    })).toEqual(['192.168.1.20']);
  });

  it('puts the key in the shared address', () => {
    expect(shareUrls(['192.168.1.20'], 4322, 'abc-_1')).toEqual(['http://192.168.1.20:4322/?key=abc-_1']);
  });

  it('only accepts the exact key', () => {
    expect(hasShareKey('/events?key=secretkey', 'secretkey')).toBe(true);
    expect(hasShareKey('/events?key=secretkez', 'secretkey')).toBe(false);
    expect(hasShareKey('/events?key=secret', 'secretkey')).toBe(false);
    expect(hasShareKey('/events', 'secretkey')).toBe(false);
  });

  it('keeps the key, so a shared address works after a restart', () => {
    const keyFile = path.join(tempFolder(), 'share-key');
    const key = readShareKey(keyFile);
    expect(key.length).toBeGreaterThanOrEqual(16);
    expect(readShareKey(keyFile)).toBe(key);
  });
});

describe('sharing the tank', () => {
  let tank: Fishtank | null = null;
  afterEach(() => { tank?.stop(); tank = null; });

  const start = async (shareOnNetwork: boolean) => {
    const folder = tempFolder();
    const settingsFile = path.join(folder, 'settings.json');
    fs.writeFileSync(settingsFile, JSON.stringify({ shareOnNetwork }));
    tank = await startServer({
      port: PORT, sharePort: SHARE_PORT, distDir: folder, settingsFile,
      copilotSessionDir: path.join(folder, 'copilot'), claudeConfigDir: path.join(folder, 'claude'), claudeDesktopSessionsDir: path.join(folder, 'desktop'),
    });
    await new Promise(resolve => setTimeout(resolve, 100));
    return path.join(folder, 'agent-fishtank-share-key');
  };

  it('is off by default', async () => {
    const keyFile = await start(false);
    await expect(request(`http://127.0.0.1:${SHARE_PORT}/events`)).rejects.toThrow();
    expect(fs.existsSync(keyFile)).toBe(false);
  });

  it('streams a watch-only feed to devices with the key, and answers nothing else', async () => {
    const key = fs.readFileSync(await start(true), 'utf8');
    expect((await request(`http://127.0.0.1:${SHARE_PORT}/events`)).status).toBe(403);
    expect((await request(`http://127.0.0.1:${SHARE_PORT}/events?key=wrong`)).status).toBe(403);
    expect((await request(`http://127.0.0.1:${SHARE_PORT}/settings`, 'POST')).status).toBe(405);
    expect((await request(`http://127.0.0.1:${SHARE_PORT}/open`, 'POST')).status).toBe(405);

    const viewer = await request(`http://127.0.0.1:${SHARE_PORT}/events?key=${key}`);
    expect(JSON.parse(viewer.firstData.replace(/^data: /, ''))).toMatchObject({ viewer: true, desktop: false });
    expect(viewer.firstData).not.toContain('"share"');

    const own = JSON.parse((await request(`http://127.0.0.1:${PORT}/events`)).firstData.replace(/^data: /, ''));
    expect(own.viewer).toBeUndefined();
    expect(own.share.urls.every((url: string) => url.endsWith(`:${SHARE_PORT}/?key=${key}`))).toBe(true);
  });
});
