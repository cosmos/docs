const { SiteChecker } = require('broken-link-checker');
const chalk = require('chalk');

let hasBrokenLinks = false;
let checkedLinks = 0;
let brokenLinks = [];

const siteChecker = new SiteChecker(
  {
    excludeExternalLinks: false, // Check external links
    excludeInternalLinks: false, // Check internal links
    excludeLinksToSamePage: true,
    filterLevel: 0,
    acceptedSchemes: ['http', 'https'],
    maxSockets: 1,
    maxSocketsPerHost: 1,
    rateLimit: 100,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    honorRobotsTxt: true,
    requestMethod: 'GET',
  },
  {
    link: (result) => {
      checkedLinks++;
      
      if (result.broken) {
        hasBrokenLinks = true;
        const linkInfo = {
          url: result.url.original,
          base: result.base.original,
          status: result.http.response ? result.http.response.statusCode : 'No response',
          brokenReason: result.brokenReason || 'Unknown error'
        };
        brokenLinks.push(linkInfo);
        
        console.error(
          chalk.red(`❌ BROKEN LINK: ${result.url.original}`),
          chalk.yellow(`\n   Found in: ${result.base.original}`),
          chalk.gray(`\n   Status: ${linkInfo.status}`),
          chalk.gray(`\n   Reason: ${linkInfo.brokenReason}`)
        );
      } else if (result.http && result.http.response) {
        // Log successful checks for external links (optional, can be verbose)
        if (result.url.original.startsWith('http') && !result.url.original.includes('localhost')) {
          process.stdout.write(chalk.gray('.'));
        }
      }
    },
    page: (error, pageUrl) => {
      if (error) {
        console.error(chalk.red(`\n❌ Error checking page: ${pageUrl}`), chalk.gray(`\n   ${error.message}`));
      }
    },
    end: () => {
      console.log(chalk.blue(`\n\n📊 Summary:`));
      console.log(chalk.blue(`   Total links checked: ${checkedLinks}`));
      console.log(chalk.blue(`   Broken links: ${brokenLinks.length}`));
      
      if (hasBrokenLinks) {
        console.error(chalk.red('\n❌ Broken links found! Please fix them before continuing.'));
        console.log(chalk.yellow('\n💡 Tip: Run with --verbose to see all checked links'));
        process.exit(1);
      } else {
        console.log(chalk.green('\n✅ No broken links found!'));
        process.exit(0);
      }
    }
  }
);

// Get base URL from environment variable or default to localhost
const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

console.log(chalk.blue(`\n🔍 Checking links on ${baseUrl}...\n`));
console.log(chalk.gray('   This may take a while depending on the number of pages and external links.\n'));

if (verbose) {
  console.log(chalk.yellow('   Verbose mode: All link checks will be displayed\n'));
}

siteChecker.enqueue(baseUrl);
