// Screenshot tool: node tools/shot.mjs out.png [--mobile] [--url U] [--wait ms]
//   [--click "selector"] [--press Key] [--hold Key ms] [--eval "js"] (actions run in order)
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'shot.png';
const mobile = argv.includes('--mobile');
const urlIx = argv.indexOf('--url');
const url = urlIx >= 0 ? argv[urlIx + 1] : 'http://localhost:8000/';

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext(
  mobile
    ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
    : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }
);
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[PAGEERROR] ${e.message}`));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

// run actions in argv order
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--wait') await page.waitForTimeout(Number(argv[++i]));
  else if (a === '--click') await page.click(argv[++i], { timeout: 3000 }).catch(e => logs.push('[CLICKFAIL] ' + e.message));
  else if (a === '--press') await page.keyboard.press(argv[++i]);
  else if (a === '--hold') { const k = argv[++i], ms = Number(argv[++i]); await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); }
  else if (a === '--eval') await page.evaluate(argv[++i]).then(r => r !== undefined && logs.push('[EVAL] ' + JSON.stringify(r))).catch(e => logs.push('[EVALFAIL] ' + e.message));
  else if (a === '--shot') { const f = argv[++i]; await page.screenshot({ path: f }); console.log('saved:', f); }
}
await page.waitForTimeout(150);
await page.screenshot({ path: out });
console.log(logs.join('\n') || '(no console output)');
console.log('saved:', out);
await browser.close();
