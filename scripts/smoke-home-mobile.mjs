import { chromium } from 'playwright';

const TARGET_URL = process.env.STATS_LC_URL || 'http://127.0.0.1:3000/#/';
const SCREENSHOT_PATH = process.env.STATS_LC_SCREENSHOT || '/tmp/stats-lc-home-mobile-smoke.png';
const VIEWPORT = { width: 390, height: 844 };
const CATEGORIES = [
  { label: /Artistas/i, kind: 'artists' },
  { label: /Musicas|Músicas/i, kind: 'tracks' },
  { label: /Albuns|Álbuns/i, kind: 'albums' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fail = (message, details = {}) => {
  const error = new Error(message);
  error.details = details;
  throw error;
};

const readHighlights = async (page) => page.evaluate(() => {
  const doc = document.documentElement;
  const section = document.querySelector('[data-stats-lc-home-highlights-source]');
  const kindSection = document.querySelector('[data-stats-lc-highlights-kind]');
  const stage = document.querySelector('[data-stats-lc-highlights-grid]');
  const firstPage = stage?.querySelector('.grid');
  const metricButton = document.querySelector('[data-stats-lc-highlights-metric-toggle]');
  const columns = firstPage ? getComputedStyle(firstPage).gridTemplateColumns : '';

  return {
    url: location.href,
    noHorizontalOverflow: doc.scrollWidth === doc.clientWidth,
    documentScrollWidth: doc.scrollWidth,
    documentClientWidth: doc.clientWidth,
    source: section?.getAttribute('data-stats-lc-home-highlights-source') || '',
    updating: section?.getAttribute('data-stats-lc-home-highlights-updating') || '',
    kind: kindSection?.getAttribute('data-stats-lc-highlights-kind') || '',
    pageCount: Number(stage?.getAttribute('data-stats-lc-highlights-page-count') || 0),
    loop: stage?.getAttribute('data-stats-lc-highlights-loop') === 'true',
    scrollerClientWidth: stage?.clientWidth || 0,
    scrollerScrollWidth: stage?.scrollWidth || 0,
    firstPageWidth: firstPage?.clientWidth || 0,
    firstPageCards: firstPage?.children.length || 0,
    firstPageGridColumns: columns,
    firstPageGridColumnCount: columns ? columns.split(' ').filter(Boolean).length : 0,
    cardCountRendered: document.querySelectorAll('[data-home-highlight-card="true"]').length,
    metric: metricButton?.getAttribute('data-stats-lc-highlights-metric') || '',
    metricValue: Number(metricButton?.getAttribute('data-stats-lc-highlights-metric-value') || 0),
    firstCardText: document.querySelector('[data-home-highlight-card="true"]')?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 140) || '',
  };
});

const openCategory = async (page, label) => {
  await page.click('[aria-label^="Categoria de destaque"]');
  await page.getByRole('button', { name: label }).click();
  await sleep(700);
};

const setMetric = async (page, metric) => {
  const current = await page.locator('[data-stats-lc-highlights-metric-toggle]').getAttribute('data-stats-lc-highlights-metric');
  if (current !== metric) {
    await page.click('[data-stats-lc-highlights-metric-toggle]');
    await sleep(250);
  }
};

const assertHighlightShape = (state, expectedKind) => {
  if (!state.noHorizontalOverflow) {
    fail('Home has horizontal document overflow', state);
  }
  if (state.kind !== expectedKind) {
    fail(`Expected highlight kind ${expectedKind}, got ${state.kind}`, state);
  }
  if (state.firstPageGridColumnCount !== 3) {
    fail('Highlights page is not a 3-column grid', state);
  }
  if (state.firstPageCards < 1 || state.firstPageCards > 6) {
    fail('Highlights page is not capped at 6 cards', state);
  }
  if (state.pageCount > 1 && !state.loop) {
    fail('Highlights carousel should loop when it has multiple pages', state);
  }
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: VIEWPORT,
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
});

const messages = [];
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    messages.push({ type: message.type(), text: message.text().slice(0, 500) });
  }
});
page.on('pageerror', (error) => {
  messages.push({ type: 'pageerror', text: String(error?.message || error).slice(0, 500) });
});

try {
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForSelector('[data-stats-lc-home-highlights-source]', { timeout: 60_000 });
  await page.waitForSelector('[data-stats-lc-home-highlights-source="replay"]', { timeout: 80_000 });
  await sleep(800);

  const categories = {};
  for (const category of CATEGORIES) {
    if (category.kind !== 'artists') {
      await openCategory(page, category.label);
    }

    await setMetric(page, 'plays');
    const plays = await readHighlights(page);
    assertHighlightShape(plays, category.kind);
    if (plays.metric !== 'plays' || plays.metricValue <= 0 || !plays.firstCardText.includes('plays')) {
      fail(`Invalid plays metric for ${category.kind}`, plays);
    }

    await setMetric(page, 'minutes');
    const minutes = await readHighlights(page);
    assertHighlightShape(minutes, category.kind);
    if (minutes.metric !== 'minutes' || minutes.metricValue <= 0 || !minutes.firstCardText.includes('min')) {
      fail(`Invalid minutes metric for ${category.kind}`, minutes);
    }

    categories[category.kind] = { plays, minutes };
  }

  await page.evaluate(() => {
    const stage = document.querySelector('[data-stats-lc-highlights-grid]');
    if (stage) stage.scrollLeft += stage.clientWidth * 2.4;
  });
  await sleep(500);
  const scrollCheck = await page.evaluate(() => {
    const stage = document.querySelector('[data-stats-lc-highlights-grid]');
    return {
      scrollLeft: stage?.scrollLeft || 0,
      clientWidth: stage?.clientWidth || 0,
      scrollWidth: stage?.scrollWidth || 0,
    };
  });
  if (categories.albums?.minutes?.pageCount > 1 && scrollCheck.scrollLeft <= 0) {
    fail('Highlights carousel did not scroll horizontally', scrollCheck);
  }

  if (messages.some((message) => message.type === 'error' || message.type === 'pageerror')) {
    fail('Console errors were emitted during Home mobile smoke', { messages });
  }

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  console.log(JSON.stringify({
    ok: true,
    url: TARGET_URL,
    viewport: `${VIEWPORT.width}x${VIEWPORT.height}`,
    screenshot: SCREENSHOT_PATH,
    categories,
    scrollCheck,
    messages,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    url: TARGET_URL,
    viewport: `${VIEWPORT.width}x${VIEWPORT.height}`,
    message: error?.message || String(error),
    details: error?.details || null,
    messages,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
