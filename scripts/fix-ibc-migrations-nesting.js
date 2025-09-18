#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_JSON_PATH = path.join(__dirname, '..', 'docs.json');

function main() {
  // Read the docs.json file
  const docsJson = JSON.parse(fs.readFileSync(DOCS_JSON_PATH, 'utf8'));

  // Find IBC dropdown
  const navigation = docsJson.navigation;

  navigation.dropdowns.forEach(dropdown => {
    if (dropdown.dropdown === 'IBC') {
      console.log('Fixing IBC Migrations nesting...');

      dropdown.versions.forEach(version => {
        version.tabs.forEach(tab => {
          if (tab.tab === 'Documentation') {
            // Find and fix IBC Migrations group
            tab.groups = tab.groups.map(group => {
              if (group.group === 'IBC Migrations') {
                // Wrap the existing pages in a nested "Migration Guides" group
                return {
                  group: 'IBC Migrations',
                  pages: [{
                    group: 'Migration Guides',
                    pages: group.pages
                  }]
                };
              } else if (group.group === 'IBC Light Clients') {
                // IBC Light Clients already has proper nesting, but let's ensure
                // any top-level pages are wrapped properly
                const topLevelPages = [];
                const nestedGroups = [];

                group.pages.forEach(item => {
                  if (typeof item === 'string') {
                    topLevelPages.push(item);
                  } else if (item.group) {
                    nestedGroups.push(item);
                  }
                });

                // If there are top-level pages, keep them at the top
                // followed by nested groups
                const newPages = [];
                if (topLevelPages.length > 0) {
                  // Keep proposals at the top level if it exists
                  const proposals = topLevelPages.filter(p => p.endsWith('/proposals'));
                  const others = topLevelPages.filter(p => !p.endsWith('/proposals'));

                  if (proposals.length > 0) {
                    newPages.push(...proposals);
                  }

                  if (others.length > 0) {
                    newPages.push({
                      group: 'Overview',
                      pages: others
                    });
                  }
                }

                newPages.push(...nestedGroups);

                return {
                  group: 'IBC Light Clients',
                  pages: newPages.length > 0 ? newPages : group.pages
                };
              }
              return group;
            });

            console.log(`  - Fixed ${version.version}`);
          }
        });
      });
    }
  });

  // Write the updated docs.json
  fs.writeFileSync(DOCS_JSON_PATH, JSON.stringify(docsJson, null, 2));
  console.log('\n✅ IBC Migrations nesting fix complete!');
  console.log(`Updated: ${DOCS_JSON_PATH}`);
}

// Run the script
main();