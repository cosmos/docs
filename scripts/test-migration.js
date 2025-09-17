#!/usr/bin/env node

import fs from 'fs';
import { convertDocusaurusToMintlify, migrationIssues } from './migrate-docusaurus.js';

const testFile = process.argv[2];
if (!testFile) {
  console.error('Usage: node test-migration.js <file-path>');
  process.exit(1);
}

console.log(`Testing migration for: ${testFile}\n`);

const content = fs.readFileSync(testFile, 'utf-8');
migrationIssues.reset();

const result = convertDocusaurusToMintlify(content, {
  version: 'next',
  product: 'sdk',
  filepath: testFile
});

const report = migrationIssues.generateReport();
if (report) {
  console.log(report);
} else {
  console.log('✅ No issues detected during migration!');
}

// Also write the result to see what was produced
const outputFile = '/tmp/test-migration-result.mdx';
fs.writeFileSync(outputFile, result.content);
console.log(`\nOutput written to: ${outputFile}`);