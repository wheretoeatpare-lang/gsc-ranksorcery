require("dotenv").config();
const cron = require("node-cron");
const SiteCrawler = require("./crawler");
const GSCSubmitter = require("./gscSubmitter");
const fs = require("fs");

const SITE_URL = process.env.SITE_URL || "https://ranksorcery.com/";

async function runSubmission() {
  const runDate = new Date().toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  console.log(`\n========================================`);
  console.log(`GSC Submission started: ${runDate}`);
  console.log(`Site: ${SITE_URL}`);
  console.log(`========================================\n`);

  // ── STEP 1: Crawl the site ──────────────────────────────────────────────
  console.log("STEP 1: Crawling website...");
  const crawler = new SiteCrawler(SITE_URL);

  // First try sitemap
  await crawler.crawlSitemap();

  // Then crawl links to find any pages missing from sitemap
  await crawler.crawlLinks(SITE_URL, 300);

  const urls = crawler.getUrls();
  console.log(`\n  Total unique URLs to submit: ${urls.length}`);

  // Save URLs to file for reference
  fs.writeFileSync("./last-crawl-urls.txt", urls.join("\n"), "utf8");
  console.log(`  URLs saved to last-crawl-urls.txt`);

  // ── STEP 2: Authenticate with Google ───────────────────────────────────
  console.log("\nSTEP 2: Authenticating with Google...");
  const submitter = new GSCSubmitter(SITE_URL);

  try {
    await submitter.authenticate();
  } catch (err) {
    console.error(`  ✗ Authentication failed: ${err.message}`);
    console.error(`  Make sure service-account.json exists and has correct permissions!`);
    return;
  }

  // ── STEP 3: Submit sitemap ──────────────────────────────────────────────
  console.log("\nSTEP 3: Submitting sitemap to Google Search Console...");
  const sitemapResult = await submitter.submitSitemap();

  // ── STEP 4: Submit individual URLs ─────────────────────────────────────
  console.log("\nSTEP 4: Submitting individual URLs to Google Indexing API...");
  console.log("  Note: Google allows 200 URL submissions per day.");

  // Take first 200 URLs (Google's daily limit)
  const urlsToSubmit = urls.slice(0, 200);
  if (urls.length > 200) {
    console.log(`  ⚠ Site has ${urls.length} URLs — submitting first 200 today, rest tomorrow.`);
  }

  const urlResults = await submitter.submitUrls(urlsToSubmit);

  // ── STEP 5: Print summary ───────────────────────────────────────────────
  console.log(`\n========================================`);
  console.log(`SUMMARY`);
  console.log(`========================================`);
  console.log(`Total URLs found   : ${urls.length}`);
  console.log(`Sitemap submitted  : ${sitemapResult.success ? "✓ Yes" : "✗ Failed"}`);
  console.log(`URLs submitted     : ${urlResults.success.length}`);
  console.log(`URLs failed        : ${urlResults.failed.length}`);
  console.log(`URLs skipped       : ${urlResults.skipped.length}`);

  if (urlResults.failed.length > 0) {
    console.log(`\nFailed URLs:`);
    urlResults.failed.forEach((f) => console.log(`  - ${f.url}: ${f.error}`));
  }

  console.log(`\nNext run: tomorrow at scheduled time`);
  console.log(`========================================\n`);
}

// ── Schedule or run immediately ──────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes("--now")) {
  console.log("Running submission now (manual trigger)...");
  runSubmission().catch(console.error);
} else {
  const schedule = process.env.CRON_SCHEDULE || "0 7 * * *";
  console.log(`GSC Submission scheduler started.`);
  console.log(`Schedule: ${schedule} (default: every day at 7:00 AM)`);
  console.log(`Site: ${SITE_URL}`);
  console.log(`Use 'node index.js --now' to run immediately.\n`);

  cron.schedule(schedule, () => {
    runSubmission().catch(console.error);
  });
}
