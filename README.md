# Daily Google Search Console Submission Bot

Crawls your website every morning, finds ALL pages (via sitemap + link crawling), submits sitemap to Google Search Console, and submits every URL to the Google Indexing API.

---

## What it does every day

1. Fetches your sitemap.xml to get all URLs
2. Crawls your site following internal links (finds pages not in sitemap)
3. Submits sitemap to Google Search Console
4. Submits up to 200 URLs/day to Google Indexing API
5. Prints a full summary report

---

## Setup (15 minutes)

### Step 1 — Install dependencies
```bash
npm install
cp .env.example .env
```

### Step 2 — Get Google Service Account Key (most important step!)

1. Go to → https://console.cloud.google.com/
2. Create a new project (or use existing)
3. Search for **"Web Search Console API"** → Enable it
4. Search for **"Indexing API"** → Enable it
5. Go to **IAM & Admin → Service Accounts**
6. Click **Create Service Account**
   - Name: `gsc-bot`
   - Click **Create and Continue → Done**
7. Click on the service account → **Keys tab**
8. Click **Add Key → Create new key → JSON**
9. Download the JSON file → rename it to `service-account.json`
10. Put `service-account.json` in this folder

### Step 3 — Add service account to Google Search Console

1. Go to → https://search.google.com/search-console
2. Select your property `ranksorcery.com`
3. Go to **Settings → Users and permissions**
4. Click **Add user**
5. Enter the service account email (looks like `gsc-bot@your-project.iam.gserviceaccount.com`)
6. Set permission to **Owner**
7. Click **Add**

### Step 4 — Update .env
```
SITE_URL=https://ranksorcery.com/
GOOGLE_SERVICE_ACCOUNT_KEY=./service-account.json
CRON_SCHEDULE=0 7 * * *
```

---

## Running

### Test right now
```bash
node index.js --now
```

### Start daily scheduler
```bash
node index.js
```

### Run in background (production)
```bash
npm install -g pm2
pm2 start index.js --name "gsc-bot"
pm2 save
pm2 startup
```

---

## Important limits

| Limit | Value |
|---|---|
| Google Indexing API daily quota | 200 URLs/day |
| Sitemap submissions | Unlimited |
| Crawl delay | 300ms between pages (polite) |

If your site has more than 200 pages, the bot automatically submits 200 today and the rest tomorrow in subsequent runs.

---

## Files

```
gsc-automation/
├── index.js              ← Main script + cron scheduler
├── crawler.js            ← Website crawler (sitemap + link crawling)
├── gscSubmitter.js       ← Google Search Console + Indexing API
├── service-account.json  ← Your Google key (you add this!)
├── .env.example          ← Config template
└── README.md
```
