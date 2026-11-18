import { describe, expect, it } from 'vitest';
import { bugReportUrl, describeComputer } from '../electron/report.ts';

describe('describeComputer', () => {
  it('names the system the way people know it', () => {
    expect(describeComputer({ platform: 'darwin', release: '27.2', arch: 'arm64' })).toBe('macOS 27.2 (arm64)');
    expect(describeComputer({ platform: 'win32', release: '10.0.26100', arch: 'x64' })).toBe('Windows 10.0.26100 (x64)');
    expect(describeComputer({ platform: 'freebsd', release: '14.1', arch: 'x64' })).toBe('freebsd 14.1 (x64)');
  });
});

describe('bugReportUrl', () => {
  it('opens the bug report form with the version and computer filled in', () => {
    const url = new URL(bugReportUrl('VinnieVH/agents-fishtank', '1.10.0', { platform: 'darwin', release: '27.2', arch: 'arm64' }));
    expect(url.origin + url.pathname).toBe('https://github.com/VinnieVH/agents-fishtank/issues/new');
    expect(url.searchParams.get('template')).toBe('bug_report.yml');
    expect(url.searchParams.get('version')).toBe('1.10.0');
    expect(url.searchParams.get('system')).toBe('macOS 27.2 (arm64)');
  });
});
