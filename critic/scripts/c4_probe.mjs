import { chromium } from '@playwright/test';
const b = await chromium.launch();
console.log(b.version());
await b.close();
