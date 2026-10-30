// Builds the server logic file from the shared rule code.
//
//   node conversion/server-logic/build.js          write the file
//   node conversion/server-logic/build.js --check  exit 1 if it is stale
//
// The output is conversion/js/rules.js regions marked "// <shared>" ...
// "// </shared>", copied verbatim, followed by src/handlers.js. No rule body
// is written by hand in the server logic file.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const here = __dirname;
const rulesPath = path.join(here, '..', 'js', 'rules.js');
const handlersPath = path.join(here, 'src', 'handlers.js');
const outPath = path.join(here, 'nb-permit-rules', 'nb-permit-rules.js');

// Returns the text of every "// <shared>" region, in order.
function sharedRegions(source) {
  const lines = source.split('\n');
  const regions = [];
  let current = null;
  for (const line of lines) {
    const t = line.trim();
    if (t === '// <shared>') {
      if (current) { throw new Error('nested <shared> marker'); }
      current = [];
    } else if (t === '// </shared>') {
      if (!current) { throw new Error('</shared> without <shared>'); }
      regions.push(current.join('\n'));
      current = null;
    } else if (current) {
      current.push(line);
    }
  }
  if (current) { throw new Error('unclosed <shared> marker'); }
  if (regions.length === 0) { throw new Error('no <shared> regions found'); }
  return regions;
}

// Removes one level of two-space indentation (the rules.js factory body).
function dedent(text) {
  return text.split('\n').map((l) => (l.startsWith('  ') ? l.slice(2) : l)).join('\n');
}

function build() {
  const rules = fs.readFileSync(rulesPath, 'utf8');
  const handlers = fs.readFileSync(handlersPath, 'utf8');
  const header = [
    '// GENERATED FILE. Do not edit.',
    '// Source: conversion/js/rules.js (<shared> regions) + conversion/server-logic/src/handlers.js',
    '// Rebuild: node conversion/server-logic/build.js',
    '// Power Pages server logic: /_api/serverlogics/nb-permit-rules',
    ''
  ].join('\n');
  const body = sharedRegions(rules).map(dedent).join('\n\n');
  return header + '\n' + body + '\n\n' + handlers;
}

module.exports = { build, sharedRegions, dedent, outPath, rulesPath };

if (require.main === module) {
  const text = build();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
    if (current !== text) {
      console.error('stale: ' + path.relative(process.cwd(), outPath) + ' (run build.js)');
      process.exit(1);
    }
    console.log('up to date');
  } else {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, text);
    console.log('wrote ' + path.relative(process.cwd(), outPath));
  }
}
