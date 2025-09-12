#!/usr/bin/env node

/**
 * Google Sheets Manager for EIP Data Versioning
 * Combines sheet tab creation and MDX generation functionality
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const SPREADSHEET_ID = '1OGscheUSh-g15p7mNYjSaxI05E8O_3R3tDK0IwXaczk';
const MAIN_SHEET_NAME = 'eip_compatibility_data';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

/**
 * Authenticate with Google Sheets API
 */
async function authenticate() {
  const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
                             path.join(__dirname, 'service-account-key.json');

  if (fs.existsSync(serviceAccountPath)) {
    const auth = new google.auth.GoogleAuth({
      keyFile: serviceAccountPath,
      scopes: SCOPES,
    });
    return auth.getClient();
  }

  // Fallback to Application Default Credentials
  const auth = new google.auth.GoogleAuth({
    scopes: SCOPES,
  });

  return auth.getClient();
}

/**
 * Create a snapshot of EIP data for a specific version
 */
async function createSheetSnapshot(version) {
  console.log(` Creating Google Sheets snapshot for version ${version}...`);

  try {
    const authClient = await authenticate();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Get spreadsheet metadata
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const existingSheets = spreadsheet.data.sheets.map(s => s.properties.title);
    console.log(`   Found existing sheets: ${existingSheets.join(', ')}`);

    // Delete existing sheet if it exists
    if (existingSheets.includes(version)) {
      const sheetToDelete = spreadsheet.data.sheets.find(s => s.properties.title === version);
      if (sheetToDelete) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [{
              deleteSheet: {
                sheetId: sheetToDelete.properties.sheetId,
              },
            }],
          },
        });
        console.log(`   ✓ Deleted existing sheet "${version}"`);
      }
    }

    // Get main sheet data
    const mainSheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${MAIN_SHEET_NAME}!A:Z`,
    });

    if (!mainSheetData.data.values || mainSheetData.data.values.length === 0) {
      throw new Error('No data found in main sheet');
    }

    console.log(`   ✓ Retrieved ${mainSheetData.data.values.length} rows from main sheet`);

    // Create new sheet
    const addSheetResponse = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title: version,
              index: 1,
              gridProperties: {
                rowCount: mainSheetData.data.values.length + 100,
                columnCount: 26,
              },
            },
          },
        }],
      },
    });

    const newSheetId = addSheetResponse.data.replies[0].addSheet.properties.sheetId;
    console.log(`   ✓ Created sheet "${version}" (ID: ${newSheetId})`);

    // Copy data to new sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${version}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: mainSheetData.data.values,
      },
    });

    console.log(`   ✓ Copied data to sheet "${version}"`);
    return { sheetId: newSheetId, rowCount: mainSheetData.data.values.length };

  } catch (error) {
    console.error(' Failed to create sheet snapshot:', error.message);

    if (error.message.includes('authentication') || error.message.includes('credentials')) {
      console.error('\n Setup Instructions:');
      console.error('1. Enable Google Sheets API in Google Cloud Console');
      console.error('2. Create service account and download key');
      console.error('3. Save key as scripts/versioning/service-account-key.json');
      console.error('4. Share spreadsheet with service account email');
      console.error('5. See GSHEET-SETUP.md for detailed instructions');
    }

    throw error;
  }
}

/**
 * Generate EIP reference MDX with sheet tab reference
 */
function generateEIPReferenceMDX(version, subdir = 'evm') {
  console.log(` Generating EIP reference MDX for ${version}...`);

  const mdxContent = `---
title: "EIP Reference"
description: "A complete list of Ethereum Mainnet \\"Final\\" EIPs and details on their implementation with Cosmos-EVM"
mode: "custom"
keywords: ['eip', 'ethereum improvement proposals', 'compatibility', 'support', 'implementation', 'cosmos evm', 'matrix', 'table']
---

import EIPCompatibilityTable from '/snippets/eip-compatibility-table.jsx'

{/*
  This is a frozen snapshot of EIP compatibility data for version ${version}
  Data source: Google Sheets tab "${version}"
  Snapshot date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
*/}

<EIPCompatibilityTable sheetTab="${version}" />

---

*This page displays a frozen snapshot of EIP compatibility data for version ${version}.*`;

  const outputPath = path.join(__dirname, '..', '..', 'docs', subdir, version, 'documentation', 'evm-compatibility', 'eip-reference.mdx');

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, mdxContent);
  console.log(`   ✓ Generated: ${outputPath}`);
  console.log(`   ✓ Uses sheetTab="${version}"`);

  return outputPath;
}

/**
 * Main function - handles both sheet creation and MDX generation
 */
async function main() {
  const version = process.argv[2];
  const subdir = process.argv[3] || process.env.DOCS_SUBDIR || process.env.SUBDIR || 'evm';

  if (!version) {
    console.error('Usage: node sheets-manager.js <version>');
    console.error('Example: node sheets-manager.js v0.5.0');
    process.exit(1);
  }

  try {
    // Create Google Sheets snapshot
    const sheetInfo = await createSheetSnapshot(version);

    // Generate MDX file
    const mdxPath = generateEIPReferenceMDX(version, subdir);

    console.log('\n Google Sheets management completed');
    console.log(` Summary:`);
    console.log(`   Version: ${version}`);
    console.log(`   Sheet ID: ${sheetInfo.sheetId}`);
    console.log(`   Rows copied: ${sheetInfo.rowCount}`);
    console.log(`   MDX generated: ${mdxPath}`);

  } catch (error) {
    console.error(' Google Sheets operation failed:', error.message);
    process.exit(1);
  }
}

// Export functions for potential reuse
export { createSheetSnapshot, generateEIPReferenceMDX };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
