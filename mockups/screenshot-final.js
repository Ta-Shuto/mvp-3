const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
  });
  const pages = [
    { name: 'final-login', url: 'file:///home/user/mvp-3/mockups/proposal-a-glassmorphism.html' },
  ];

  // Take screenshot of the actual built HTML mockup to show the style
  // But we can also generate a quick preview of key pages
  const htmlPages = [
    { name: 'final-dashboard', file: 'preview-dashboard.html' },
    { name: 'final-login', file: 'preview-login.html' },
  ];

  for (const p of htmlPages) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`file:///home/user/mvp-3/mockups/${p.file}`);
    await page.screenshot({ path: `/home/user/mvp-3/mockups/${p.name}.png`, fullPage: false });
    console.log(`Captured: ${p.name}.png`);
    await page.close();
  }

  await browser.close();
})();
