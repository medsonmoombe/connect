import { chromium } from 'file:///C:/Users/USER/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:3000';
const CHROME = process.env.CHROME_PATH || 'C:\\Users\\USER\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1228\\chrome-headless-shell-win64\\chrome-headless-shell.exe';

async function measure(page, label) {
  const m = await page.evaluate((labelText) => {
    const doc = document.documentElement;
    const main = document.querySelector('main');
    const results = [];
    if (main) {
      const mainRect = main.getBoundingClientRect();
      for (const el of main.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.bottom > mainRect.bottom + 1) {
          results.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || '').toString().slice(0, 140),
            bottom: Math.round(r.bottom),
            h: Math.round(r.height),
          });
        }
      }
    }
    return {
      label: labelText,
      mainScrollHeight: main ? main.scrollHeight : null,
      mainClientHeight: main ? main.clientHeight : null,
      docScrollHeight: doc.scrollHeight,
      windowInnerH: window.innerHeight,
      beyondEls: results.slice(0, 14),
    };
  }, label);
  console.log(JSON.stringify(m, null, 2));
  return m;
}

const browser = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1545, height: 944 } });
const page = await ctx.newPage();
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

// Login
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'james.mwanza@solargen.co.zm');
await page.fill('#password', 'Admin1234!');
await page.click('button[type="submit"]');
await page.waitForURL(/dashboard|developer|onboarding|verification|verify-otp/, { timeout: 25000 }).catch(async () => {
  const err = await page.locator('form .text-red-500, [class*="red"]').allTextContents().catch(() => []);
  console.log('login did not navigate; page banners:', err.slice(0, 3));
});
await page.waitForTimeout(2000);
console.log('after login URL:', page.url());

// Go to submit page
await page.goto(`${BASE}/developer/submit`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
console.log('submit URL:', page.url());

const before = await measure(page, 'before click');

// Click the first approval card head
const cards = page.locator('label:has(span.font-mono)');
const count = await cards.count();
console.log('approval-card labels found:', count);
if (count > 0) {
  await cards.last().click();
  await page.waitForTimeout(700);
  await measure(page, 'after click card');
}

await page.screenshot({ path: 'scripts/repro-overflow.png', fullPage: false });
await browser.close();
