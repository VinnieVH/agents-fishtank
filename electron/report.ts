// The "Report a Bug…" link: opens the bug report form (.github/ISSUE_TEMPLATE/bug_report.yml) with the version and
// system filled in. GitHub fills a form field from the query parameter with the same name as its id.

const SYSTEM_NAMES: Partial<Record<NodeJS.Platform, string>> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' };

export interface Computer { platform: NodeJS.Platform; release: string; arch: string }

/** "macOS 27.2 (arm64)" */
export const describeComputer = ({ platform, release, arch }: Computer): string =>
  `${SYSTEM_NAMES[platform] ?? platform} ${release} (${arch})`;

export const bugReportUrl = (repo: string, version: string, computer: Computer): string => {
  const query = new URLSearchParams({ template: 'bug_report.yml', version, system: describeComputer(computer) });
  return `https://github.com/${repo}/issues/new?${query}`;
};
