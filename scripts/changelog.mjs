// Writes the website's "What's new" page (changelog.html) from the git history: one section per version tag, one line
// per commit between it and the tag before. Run by .github/workflows/pages.yml: node scripts/changelog.mjs <folder>
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const escape = text => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const byVersion = (a, b) => b.localeCompare(a, undefined, { numeric: true });

const tags = git('tag', '--list', 'v*').split('\n').filter(Boolean).sort(byVersion);
const KINDS = { feat: 'New', fix: 'Fixed', perf: 'Faster' };

/** A commit title as a line: the type and scope become a small label, the rest is the sentence. */
const line = title => {
  const match = /^(\w+)(?:\(([^)]*)\))?!?: (.+)$/.exec(title);
  if (!match) return `<li>${escape(title)}</li>`;
  const [, type, scope, text] = match;
  const label = KINDS[type] ? `<b class="${type}">${KINDS[type]}</b> ` : '';
  return `<li>${label}${scope ? `<span class="scope">${escape(scope)}</span> ` : ''}${escape(text)}</li>`;
};

const section = (tag, older) => {
  const range = older ? `${older}..${tag}` : tag;
  const titles = git('log', '--no-merges', '--format=%s', range).split('\n')
    .filter(title => title && !/^chore\(release\)/.test(title));
  const date = git('log', '-1', '--format=%cs', tag);
  const version = tag.replace(/^v/, '');
  return `<section class="release" id="${tag}"><h2>${version} <small>${date}</small></h2>
  <ul>${titles.map(line).join('\n  ')}</ul>
  <p class="more"><a href="https://github.com/VinnieVH/agents-fishtank/releases/tag/${tag}">Release notes and downloads</a></p></section>`;
};

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>What's new · Agent Fishtank</title>
<meta name="description" content="Every version of Agent Fishtank and what changed in it.">
<link rel="icon" href="icon.png">
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="bubbles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>

<header class="hero small-hero">
  <a href="./" class="back">← Agent Fishtank</a>
  <h1>What's new</h1>
  <p class="lead">Every version and what changed in it, newest first.</p>
</header>

<main class="changelog">
${tags.map((tag, index) => section(tag, tags[index + 1])).join('\n')}
</main>

<footer>
  <a href="./">Home</a> ·
  <a href="docs.html">Documentation</a> ·
  <a href="https://github.com/VinnieVH/agents-fishtank/releases">All releases</a> ·
  MIT license
</footer>
</body>
</html>
`;

writeFileSync(join(process.argv[2] ?? '.', 'changelog.html'), page);
