#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_JSON_PATH = path.join(__dirname, '..', 'docs.json');

/**
 * Group SDK pages by their category (e.g., build, learn, tutorials, user)
 * and then by subcategory (e.g., building-apps, building-modules, etc.)
 */
function restructureSDKNavigation(pages) {
  const grouped = {
    'Build': {
      'Building Apps': [],
      'Building Modules': [],
      'ABCI': [],
      'Architecture': [],
      'Migrations': [],
      'Packages': [],
      'RFC': [],
      'Spec': [],
      'Tooling': [],
      'Modules': [],
      'Other': []
    },
    'Learn': {
      'Introduction': [],
      'Beginner': [],
      'Advanced': [],
      'Other': []
    },
    'Tutorials': {
      'Transactions': [],
      'Vote Extensions': [],
      'Other': []
    },
    'User': {
      'Run a Node': [],
      'Other': []
    }
  };

  // Process each page and categorize it
  pages.forEach(page => {
    if (typeof page === 'string') {
      const parts = page.split('/');
      const category = parts[3]; // e.g., 'build', 'learn', 'tutorials', 'user'
      const subcategory = parts[4]; // e.g., 'building-apps', 'advanced', etc.

      if (category === 'build') {
        if (subcategory === 'building-apps') {
          grouped['Build']['Building Apps'].push(page);
        } else if (subcategory === 'building-modules') {
          grouped['Build']['Building Modules'].push(page);
        } else if (subcategory === 'abci') {
          grouped['Build']['ABCI'].push(page);
        } else if (subcategory === 'architecture') {
          grouped['Build']['Architecture'].push(page);
        } else if (subcategory === 'migrations') {
          grouped['Build']['Migrations'].push(page);
        } else if (subcategory === 'packages') {
          grouped['Build']['Packages'].push(page);
        } else if (subcategory === 'rfc') {
          grouped['Build']['RFC'].push(page);
        } else if (subcategory === 'spec') {
          grouped['Build']['Spec'].push(page);
        } else if (subcategory === 'tooling') {
          grouped['Build']['Tooling'].push(page);
        } else if (subcategory === 'modules') {
          grouped['Build']['Modules'].push(page);
        } else {
          grouped['Build']['Other'].push(page);
        }
      } else if (category === 'learn') {
        if (subcategory === 'intro') {
          grouped['Learn']['Introduction'].push(page);
        } else if (subcategory === 'beginner') {
          grouped['Learn']['Beginner'].push(page);
        } else if (subcategory === 'advanced') {
          grouped['Learn']['Advanced'].push(page);
        } else {
          grouped['Learn']['Other'].push(page);
        }
      } else if (category === 'tutorials') {
        if (subcategory === 'transactions') {
          grouped['Tutorials']['Transactions'].push(page);
        } else if (subcategory === 'vote-extensions') {
          grouped['Tutorials']['Vote Extensions'].push(page);
        } else {
          grouped['Tutorials']['Other'].push(page);
        }
      } else if (category === 'user') {
        if (subcategory === 'run-node') {
          grouped['User']['Run a Node'].push(page);
        } else {
          grouped['User']['Other'].push(page);
        }
      }
    }
  });

  // Build the new nested structure
  const newGroups = [];

  Object.entries(grouped).forEach(([mainGroup, subGroups]) => {
    const pages = [];

    // Add overview page if it exists
    const overviewPage = Object.values(subGroups).flat().find(p =>
      p.endsWith(`/${mainGroup.toLowerCase()}/${mainGroup.toLowerCase()}`) ||
      p.endsWith(`/${mainGroup.toLowerCase()}/README`)
    );

    if (overviewPage) {
      pages.push(overviewPage);
    }

    // Add nested groups
    Object.entries(subGroups).forEach(([subGroup, subPages]) => {
      if (subPages.length > 0 && subGroup !== 'Other') {
        pages.push({
          group: subGroup,
          pages: subPages.sort()
        });
      }
    });

    // Add "Other" pages directly if they exist
    if (subGroups['Other'] && subGroups['Other'].length > 0) {
      pages.push(...subGroups['Other'].sort());
    }

    if (pages.length > 0) {
      newGroups.push({
        group: `Cosmos SDK - ${mainGroup}`,
        pages: pages
      });
    }
  });

  return newGroups;
}

/**
 * Group IBC pages by their category
 */
function restructureIBCNavigation(groups) {
  const newGroups = [];

  groups.forEach(group => {
    if (group.group === 'IBC') {
      // Keep intro page as is
      newGroups.push({
        group: 'IBC-Go',
        pages: group.pages
      });
    } else if (group.group === 'Ibc') {
      // Restructure main IBC pages
      const grouped = {
        'Core Concepts': [],
        'Apps': [],
        'Middleware': [],
        'Upgrades': [],
        'Other': []
      };

      group.pages.forEach(page => {
        if (typeof page === 'string') {
          const parts = page.split('/');
          const lastPart = parts[parts.length - 1];
          const secondLastPart = parts[parts.length - 2];

          if (secondLastPart === 'apps') {
            grouped['Apps'].push(page);
          } else if (secondLastPart === 'middleware') {
            grouped['Middleware'].push(page);
          } else if (secondLastPart === 'upgrades') {
            grouped['Upgrades'].push(page);
          } else if (['overview', 'integration', 'relayer', 'best-practices', 'permissioning', 'channel-upgrades', 'proposals', 'proto-docs', 'roadmap', 'troubleshooting', 'capability-module'].includes(lastPart)) {
            grouped['Core Concepts'].push(page);
          } else {
            grouped['Other'].push(page);
          }
        }
      });

      const pages = [];

      // Add overview first if it exists
      const overview = grouped['Core Concepts'].find(p => p.endsWith('/overview'));
      if (overview) {
        pages.push(overview);
        grouped['Core Concepts'] = grouped['Core Concepts'].filter(p => p !== overview);
      }

      // Add nested groups
      Object.entries(grouped).forEach(([subGroup, subPages]) => {
        if (subPages.length > 0 && subGroup !== 'Other') {
          pages.push({
            group: subGroup,
            pages: subPages.sort()
          });
        }
      });

      // Add other pages
      if (grouped['Other'].length > 0) {
        pages.push(...grouped['Other'].sort());
      }

      newGroups.push({
        group: 'IBC Core',
        pages: pages
      });
    } else if (group.group === 'Light Clients') {
      // Restructure Light Clients
      const grouped = {
        'Developer Guide': [],
        'Localhost': [],
        'Solo Machine': [],
        'Tendermint': [],
        'WASM': [],
        'Other': []
      };

      group.pages.forEach(page => {
        if (typeof page === 'string') {
          const parts = page.split('/');
          const secondLastPart = parts[parts.length - 2];

          if (secondLastPart === 'developer-guide') {
            grouped['Developer Guide'].push(page);
          } else if (secondLastPart === 'localhost') {
            grouped['Localhost'].push(page);
          } else if (secondLastPart === 'solomachine') {
            grouped['Solo Machine'].push(page);
          } else if (secondLastPart === 'tendermint') {
            grouped['Tendermint'].push(page);
          } else if (secondLastPart === 'wasm') {
            grouped['WASM'].push(page);
          } else {
            grouped['Other'].push(page);
          }
        }
      });

      const pages = [];

      // Add proposals first if exists
      const proposals = grouped['Other'].find(p => p.endsWith('/proposals'));
      if (proposals) {
        pages.push(proposals);
        grouped['Other'] = grouped['Other'].filter(p => p !== proposals);
      }

      // Add nested groups
      Object.entries(grouped).forEach(([subGroup, subPages]) => {
        if (subPages.length > 0 && subGroup !== 'Other') {
          pages.push({
            group: subGroup,
            pages: subPages.sort()
          });
        }
      });

      // Add other pages
      if (grouped['Other'].length > 0) {
        pages.push(...grouped['Other'].sort());
      }

      newGroups.push({
        group: 'IBC Light Clients',
        pages: pages
      });
    } else if (group.group === 'Apps') {
      // Restructure Apps
      const grouped = {
        'Interchain Accounts': [],
        'Transfer': [],
        'Legacy': []
      };

      group.pages.forEach(page => {
        if (typeof page === 'string') {
          const parts = page.split('/');
          const secondLastPart = parts[parts.length - 2];
          const thirdLastPart = parts[parts.length - 3];

          if (thirdLastPart === 'interchain-accounts' && secondLastPart === 'legacy') {
            grouped['Legacy'].push(page);
          } else if (thirdLastPart === 'interchain-accounts' || secondLastPart === 'interchain-accounts') {
            grouped['Interchain Accounts'].push(page);
          } else if (secondLastPart === 'transfer' || thirdLastPart === 'transfer') {
            grouped['Transfer'].push(page);
          }
        }
      });

      const pages = [];

      // Add Interchain Accounts with legacy as nested
      if (grouped['Interchain Accounts'].length > 0) {
        const icaPages = [...grouped['Interchain Accounts'].sort()];
        if (grouped['Legacy'].length > 0) {
          icaPages.push({
            group: 'Legacy',
            pages: grouped['Legacy'].sort()
          });
        }
        pages.push({
          group: 'Interchain Accounts',
          pages: icaPages
        });
      }

      // Add Transfer
      if (grouped['Transfer'].length > 0) {
        pages.push({
          group: 'Transfer',
          pages: grouped['Transfer'].sort()
        });
      }

      newGroups.push({
        group: 'IBC Apps',
        pages: pages
      });
    } else if (group.group === 'Middleware') {
      // Restructure Middleware - keep callbacks together
      newGroups.push({
        group: 'IBC Middleware',
        pages: [{
          group: 'Callbacks',
          pages: group.pages.sort()
        }]
      });
    } else if (group.group === 'Migrations') {
      // Keep Migrations as is but rename
      newGroups.push({
        group: 'IBC Migrations',
        pages: group.pages.sort()
      });
    }
  });

  return newGroups;
}

/**
 * Main function to restructure the navigation
 */
function main() {
  // Read the docs.json file
  const docsJson = JSON.parse(fs.readFileSync(DOCS_JSON_PATH, 'utf8'));

  // Find SDK and IBC dropdowns
  const navigation = docsJson.navigation;

  navigation.dropdowns.forEach(dropdown => {
    if (dropdown.dropdown === 'SDK') {
      console.log('Restructuring SDK navigation...');

      dropdown.versions.forEach(version => {
        version.tabs.forEach(tab => {
          if (tab.tab === 'Documentation') {
            // Collect all pages from all groups
            const allPages = [];
            tab.groups.forEach(group => {
              if (group.pages) {
                allPages.push(...group.pages);
              }
            });

            // Restructure the pages
            const newGroups = restructureSDKNavigation(allPages);

            // Replace the groups
            tab.groups = newGroups;

            console.log(`  - Restructured ${version.version} with ${newGroups.length} main groups`);
          }
        });
      });
    } else if (dropdown.dropdown === 'IBC') {
      console.log('Restructuring IBC navigation...');

      dropdown.versions.forEach(version => {
        version.tabs.forEach(tab => {
          if (tab.tab === 'Documentation') {
            // Restructure the groups
            const newGroups = restructureIBCNavigation(tab.groups);

            // Replace the groups
            tab.groups = newGroups;

            console.log(`  - Restructured ${version.version} with ${newGroups.length} main groups`);
          }
        });
      });
    }
  });

  // Write the updated docs.json
  fs.writeFileSync(DOCS_JSON_PATH, JSON.stringify(docsJson, null, 2));
  console.log('\n✅ Navigation restructuring complete!');
  console.log(`Updated: ${DOCS_JSON_PATH}`);
}

// Run the script
main();