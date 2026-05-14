const { google } = require("googleapis");
const axios = require("axios");

class GSCSubmitter {
  constructor(siteUrl) {
    this.siteUrl = siteUrl.replace(/\/$/, "");
    this.auth = null;
  }

  async authenticate() {
    let credentials;

    // ── Read service account from environment variable (Railway/production)
    // or fall back to local file (local testing)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      try {
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        console.log("  Using service account from environment variable");
      } catch (err) {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON: " + err.message);
      }
    } else if (require("fs").existsSync("./service-account.json")) {
      credentials = require("./service-account.json");
      console.log("  Using service account from service-account.json file");
    } else {
      throw new Error(
        "No service account found! Set GOOGLE_SERVICE_ACCOUNT_JSON env variable or add service-account.json file."
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/webmasters",
        "https://www.googleapis.com/auth/indexing",
      ],
    });

    this.auth = await auth.getClient();
    this.accessToken = await this.auth.getAccessToken();
    console.log("  Google API authenticated!");
  }

  // Submit sitemap to Google Search Console
  async submitSitemap() {
    const sitemapUrl = `${this.siteUrl}/sitemap.xml`;
    console.log(`\n  Submitting sitemap: ${sitemapUrl}`);

    try {
      const webmasters = google.webmasters({ version: "v3", auth: this.auth });
      await webmasters.sitemaps.submit({
        siteUrl: `${this.siteUrl}/`,
        feedpath: sitemapUrl,
      });
      console.log("  ✓ Sitemap submitted successfully!");
      return { success: true, sitemapUrl };
    } catch (err) {
      console.error(`  ✗ Sitemap submission failed: ${err.message}`);
      return { success: false, error: err.message, sitemapUrl };
    }
  }

  // Submit individual URLs via Google Indexing API
  async submitUrls(urls) {
    console.log(`\n  Submitting ${urls.length} URLs to Google Indexing API...`);

    const results = { success: [], failed: [], skipped: [] };
    let count = 0;

    for (const url of urls) {
      try {
        await axios.post(
          "https://indexing.googleapis.com/v3/urlNotifications:publish",
          { url, type: "URL_UPDATED" },
          {
            headers: {
              Authorization: `Bearer ${this.accessToken.token}`,
              "Content-Type": "application/json",
            },
          }
        );

        results.success.push(url);
        count++;
        process.stdout.write(`\r  Submitted: ${count}/${urls.length} URLs`);

        // Google Indexing API allows 200 requests/day — add delay
        await sleep(500);
      } catch (err) {
        const status = err.response?.status;
        if (status === 429) {
          console.log(`\n  Rate limit hit — pausing 60 seconds...`);
          await sleep(60000);
          results.skipped.push(url);
        } else {
          results.failed.push({
            url,
            error: err.response?.data?.error?.message || err.message,
          });
        }
      }
    }

    console.log(
      `\n  ✓ Done! ${results.success.length} submitted, ${results.failed.length} failed, ${results.skipped.length} skipped`
    );
    return results;
  }

  // Check indexing status of URLs
  async checkIndexingStatus(urls) {
    console.log(`\n  Checking indexing status for ${urls.length} URLs...`);
    const statuses = [];

    for (const url of urls.slice(0, 50)) {
      try {
        const res = await axios.get(
          `https://indexing.googleapis.com/v3/urlNotifications/metadata?url=${encodeURIComponent(url)}`,
          {
            headers: { Authorization: `Bearer ${this.accessToken.token}` },
          }
        );
        statuses.push({
          url,
          latestUpdate: res.data.latestUpdate?.type || "Never submitted",
          notifyTime: res.data.latestUpdate?.notifyTime || null,
        });
        await sleep(200);
      } catch {
        statuses.push({ url, latestUpdate: "Unknown", notifyTime: null });
      }
    }

    return statuses;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = GSCSubmitter;
