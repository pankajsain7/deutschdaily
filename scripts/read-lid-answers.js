// Maintenance utility. Requires Playwright with Chromium; the app itself has no dependencies.
const { writeFile } = require('node:fs/promises');
const { chromium } = require('playwright');

const testCenter = 'https://oet.bamf.de/ords/oetut/f?p=534:1:0:::::';

async function collectAnswers(output) {
  const browser = await chromium.launch({ executablePath: process.env.LID_BROWSER_PATH });
  try {
    const page = await browser.newPage();
    await page.goto(testCenter);
    await page.locator('#P1_BUL_ID').selectOption({ label: 'Baden-Württemberg' });
    await page.getByRole('button', { name: 'Zum Fragenkatalog' }).click();
    const records = [];
    for (let number = 1; number <= 310; number++) {
      await page.getByText(`Aufgabe ${number} von 310`, { exact: true }).waitFor();
      await page.locator('input[type=radio][name=f20]').first().click();
      const record = await page.evaluate(() => {
        const options = [...document.querySelectorAll('td[headers="ANTWORT"]')];
        const visibleMarker = options.findIndex(option => {
          const marker = option.closest('tr').querySelector('td[headers="RICHTIGE_ANTWORT"] span');
          return marker?.innerText.trim().startsWith('richtige Antwort')
            && getComputedStyle(marker).visibility === 'visible';
        });
        return { options: options.map(option => option.innerText.trim()), answer: visibleMarker };
      });
      if (record.options.length !== 4 || record.answer < 0) {
        throw new Error(`Aufgabe ${number}: Lösung konnte im BAMF Online-Testcenter nicht geprüft werden.`);
      }
      records.push({ number, ...record });
      if (number < 310) {
        await new Promise(resolve => setTimeout(resolve, 220));
        await page.locator('input[name="GET_NEXT_ID"]').click();
      }
    }
    await writeFile(output, records.map(row => JSON.stringify(row)).join('\n') + '\n');
    console.log(`${output}: ${records.length} offizielle Lösungen geprüft.`);
  } finally {
    await browser.close();
  }
}

const output = process.argv[2];
if (!output) {
  console.error('Aufruf: node scripts/read-lid-answers.js <antworten.jsonl>');
  process.exitCode = 1;
} else {
  collectAnswers(output).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
