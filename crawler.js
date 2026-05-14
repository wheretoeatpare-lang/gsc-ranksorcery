const axios = require("axios");
const cheerio = require("cheerio");

class SiteCrawler {
  constructor(siteUrl) {
    this.siteUrl = siteUrl.replace(/\/$/, "");
    this.visited = new Set();
    this.urls = new Set();
  }

  // Step 1: Try to get URLs from sitemap.xml
  async crawlSitemap() {
    const sitemapUrl = `${this.siteUrl}/sitemap.xml`;
    console.log(`  Fetching sitemap: ${sitemapUrl}`);
    try {
      const res = await axios.get(sitemapUrl, { timeout: 10000 });
      const xml = res.data;

      // Extract all <loc> tags from sitemap
      const matches = xml.match(/<loc>(.*?)<\/loc>/g) || [];
      matches.forEach((m) => {
        const url = m.replace(/<\/?loc>/g, "").trim();
        if (url.startsWith(this.siteUrl)) {
          this.urls.add(url);
        }
      });

      // Handle sitemap index (sitemap of sitemaps)
      const sitemapRefs = xml.match(/<sitemap>[\s\S]*?<\/sitemap>/g) || [];
      for (const ref of sitemapRefs) {
        const locMatch = ref.match(/<loc>(.*?)<\/loc>/);
        if (locMatch) {
          await this.crawlNestedSitemap(locMatch[1]);
        }
      }

      console.log(`  Found ${this.urls.size} URLs in sitemap`);
    } catch (err) {
      console.log(`  No sitemap found or error: ${err.message}`);
    }
  }

  async crawlNestedSitemap(sitemapUrl) {
    try {
      const res = await axios.get(sitemapUrl, { timeout: 10000 });
      const matches = res.data.match(/<loc>(.*?)<\/loc>/g) || [];
      matches.forEach((m) => {
        const url = m.replace(/<\/?loc>/g, "").trim();
        if (url.startsWith(this.siteUrl)) this.urls.add(url);
      });
    } catch {}
  }

  // Step 2: Crawl pages by following internal links
  async crawlLinks(startUrl, maxPages = 200) {
    const queue = [startUrl || this.siteUrl];
    let crawled = 0;

    while (queue.length > 0 && crawled < maxPages) {
      const url = queue.shift();
      if (this.visited.has(url)) continue;
      this.visited.add(url);

      try {
        const res = await axios.get(url, {
          timeout: 10000,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SEOBot/1.0)" },
        });

        this.urls.add(url);
        crawled++;
        process.stdout.write(`\r  Crawled: ${crawled} pages...`);

        const $ = cheerio.load(res.data);
        $("a[href]").each((_, el) => {
          let href = $(el).attr("href");
          if (!href) return;

          // Resolve relative URLs
          if (href.startsWith("/")) href = `${this.siteUrl}${href}`;
          if (!href.startsWith(this.siteUrl)) return;

          // Clean URL — remove fragments and query strings
          href = href.split("#")[0].split("?")[0];
          if (!href) return;

          // Skip non-HTML resources
          if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|css|js|xml|json)$/i.test(href)) return;

          if (!this.visited.has(href)) queue.push(href);
        });

        await sleep(300); // polite crawl delay
      } catch (err) {
        // Skip pages that error
      }
    }

    console.log(`\n  Crawl complete — ${this.urls.size} total unique URLs found`);
  }

  getUrls() {
    return [...this.urls].filter((url) => {
      // Filter out non-indexable patterns
      return !url.includes("#") &&
        !url.includes("?") &&
        !/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|css|js)$/i.test(url);
    });
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = SiteCrawler;
