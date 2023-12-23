const blessed = require(`blessed`);
const os = require(`node:os`);
const { addExtra } = require('puppeteer-extra')
const vanillaPuppeteer = require('puppeteer');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')

const screen = blessed.screen({
    smartCSR: true,
    title: `top.gg scraper`,
});
const outputBox = blessed.box({
    top: 0,
    left: 0,
    width: `50%`,
    height: `50%`,
    label: `> invites`,
    tags: true,
    border: { type: `line`, },
    style: {
        fg: `white`,
        border: {
            fg: `brightblack`
        },
        label: {
            fg: `brightred`
        }
    }
});
const logBox = blessed.box({
    top: 0,
    left: `50%`,
    width: `50%`,
    height: `100%`,
    label: `> log`,
    tags: true,
    border: { type: `line`, },
    style: {
        fg: `white`,
        border: {
            fg: `brightblack`
        },
        label: {
            fg: `cyan`
        }
    }
});
const infoBox = blessed.box({
    top: `50%`,
    left: 0,
    height: `50%`,
    width: `50%`,
    label: `> info`,
    tags: true,
    border: { type: `line`, },
    style: {
        fg: `white`,
        border: {
            fg: `brightblack`
        },
        label: {
            fg: `brightyellow`
        }
    }
});
screen.append(outputBox);
screen.append(logBox);
screen.append(infoBox);
screen.key([`escape`, `q`, `C-c`], (ch, key) => {
    return process.exit(0);
});

function log(message) { logBox.insertBottom(message); }
function output(message) { outputBox.insertBottom(message); }

let totalScraped = 0;
let startTime = Date.now()
function calculateUptime() {
    const uptimeInMillis = Date.now() - startTime;
    const [h, m, s, ms] = [
        uptimeInMillis / 3.6e6,
        (uptimeInMillis % 3.6e6) / 6e4,
        (uptimeInMillis % 6e4) / 1000,
        Math.floor(uptimeInMillis % 1000 / 10)
    ].map(val => val.toFixed(0).padStart(2, '0'));

    return `${h}:${m}:${s}.${ms}`;
}

const stats = {
    totalLinks: 0,
    uptime: calculateUptime(),
    totalMemory: os.totalmem() / (1024 * 1024),
    freeMemory: os.freemem() / (1024 * 1024)
};

setInterval(() => {
    infoBox.content = `time: ${stats.uptime}\nfound: ${stats.totalLinks}\nmem: ${stats.freeMemory}/${stats.totalMemory} MB`
    screen.render()
}, 0);

screen.render();

(async () => {
    log('starting...');
    log('launching browser...');

    const puppeteer = addExtra(vanillaPuppeteer)
    const adblocker = AdblockerPlugin({
        blockTrackers: true
    });
    
    puppeteer.use(adblocker)
    puppeteer.use(StealthPlugin())

    const browser = await puppeteer.launch({
        headless: false
    });

    log(`launched, running chromium version ${await browser.version()}!`);

    log('creating page...');
    const page = await browser.newPage();

    log('visiting top.gg...');
    await page.goto('https://top.gg/');

    while (true) {
        const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return anchors.map(anchor => ({
                href: anchor.href,
                text: anchor.textContent
            }));
        });

        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight);
        });

        await page.waitForTimeout(1000);
    }

    await browser.close();
})();