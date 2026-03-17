const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
  });
  const pages = [
    { name: 'proposal-a-glassmorphism', file: 'proposal-a-glassmorphism.html' },
    { name: 'proposal-b-dark-neon', file: 'proposal-b-dark-neon.html' },
    { name: 'proposal-c-shadcn', file: 'proposal-c-shadcn.html' },
  ];

  for (const p of pages) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`file:///home/user/mvp-3/mockups/${p.file}`);
    await page.screenshot({ path: `/home/user/mvp-3/mockups/${p.name}.png`, fullPage: false });
    console.log(`Captured: ${p.name}.png`);
    await page.close();
  }

  await browser.close();
})();
