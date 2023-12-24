const blessed = require(`blessed`);
const os = require(`node:os`);
const fs = require('node:fs');
const { log } = require('node:console');
const config = require(`./config.json`);

const screen = blessed.screen({
    smartCSR: true,
    title: `top.gg scraper`,
});
const output = blessed.log({
    top: 0,
    left: 0,
    width: `50%`,
    height: `75%`,
    label: ` > invites `,
    tags: true,
    alwaysScroll: true,
    scrollable: true,
    border: { type: `line`, },
    style: {
        fg: `white`,
        border: {
            fg: `red`
        },
        label: {
            fg: `brightred`
        }
    }
});
const logger = blessed.log({
    top: 0,
    left: `50%`,
    width: `50%`,
    height: `100%`,
    label: ` > log `,
    tags: true,
    alwaysScroll: true,
    scrollable: true,
    border: { type: `line`, },
    style: {
        fg: `white`,
        border: {
            fg: `brightblue`
        },
        label: {
            fg: `cyan`
        }
    }
});
const info = blessed.box({
    top: `75%`,
    left: 0,
    height: `25%`,
    width: `50%`,
    label: ` > info `,
    tags: true,
    border: { type: `line`, },
    style: {
        fg: `white`,
        border: {
            fg: `yellow`
        },
        label: {
            fg: `brightyellow`
        }
    }
});
screen.append(output);
screen.append(logger);
screen.append(info);
screen.key([`escape`, `q`, `C-c`], (ch, key) => {
    return process.exit(0);
});
function writeFile(text) {
    const filename = 'output.txt';

    if (!fs.existsSync(filename)) {
        fs.writeFileSync(filename, ``);
    }
    fs.appendFileSync(filename, text + `\n`);
}
logger.log(`screen loaded.`)

let totalScraped = 0;
let totalRequests = 0;
let searchIterations = 0;
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
function calculateLinksPerMinute() {
    return (totalScraped / ((Date.now() - startTime) / 1000 / 60)).toFixed(2);
}
let stats = {
    totalLinks: totalScraped,
    uptime: calculateUptime(),
    totalMemory: os.totalmem() / (1024 * 1024 * 1024),
    freeMemory: os.freemem() / (1024 * 1024 * 1024),
    linksPerMinute: calculateLinksPerMinute(),
    totalRequests: totalRequests,
    searchIterations: searchIterations
};

setInterval(() => {
    info.content = `time: ${stats.uptime}\nfound: ${stats.totalLinks} (~${stats.linksPerMinute} per minute)\nmem: ${stats.freeMemory.toFixed(0)}/${stats.totalMemory.toFixed(0)} GB\ntotal requests: ${stats.totalRequests}\nsearch iterations: ${stats.searchIterations}`
    screen.render()
    stats = {
        totalLinks: totalScraped,
        uptime: calculateUptime(),
        totalMemory: os.totalmem() / (1024 * 1024 * 1024),
        freeMemory: os.freemem() / (1024 * 1024 * 1024),
        linksPerMinute: calculateLinksPerMinute(),
        totalRequests: totalRequests,
        searchIterations: searchIterations
    };
}, 10);

screen.render();

(async () => {
    logger.log('starting...');
    async function fetchData(skip = 0) {
        searchIterations++;
        const url = `https://top.gg/api/client/entities/search?platform=discord&entityType=bot&${config.searchparams}&amount=${config.invitespersearchrequest}&skip=${skip}`;
        logger.log(`searching with url ${url}...`)

        const headers = {
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive',
            'DNT': '1',
            'Host': 'top.gg',
            'Referer': 'https://top.gg/list/top',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"'
        };

        fs.readFile(`./cookie.txt`, (err, data) => {
            headers.Cookie = data;
            if (err) {
                logger.log(err);
            };
        });

        try {
            let response = '';
            await fetch(url, { headers }).then(reply => {
                response = reply;
                logger.log(`code ${response.status} from ${url}`);
                totalRequests++;
            });
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                const resultIds = data.results.map(result => result.id);
                logger.log(`got ${resultIds.length} bot IDs. getting discord auth links...`);

                for (const id of resultIds) {
                    logger.log(`pulling top.gg redirect from ${id}`);

                    const inviteUrl = `https://top.gg/_next/data/3ec65ad-prod/en/bot/${id}/invite.json?botId=${id}`;
                    let inviteResponse = ``;
                    await fetch(inviteUrl, { headers }).then(reply => {
                        inviteResponse = reply;
                        logger.log(`code ${inviteResponse.status} from ${inviteUrl}`);
                        totalRequests++;
                    });

                    const inviteData = await inviteResponse.json();
                    const redirectLink = inviteData.pageProps.__N_REDIRECT;

                    if (redirectLink.includes("https://discord.com/") || redirectLink.includes("https://discordapp.com/")) {
                        logger.log(`vanilla discord bot invite found for ${id}!`);
                        const clientId = redirectLink.match(/client_id=(\d+)/)[1];
                        let link;

                        if (config.clearpermissionsandscopes) {
                            link = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=0&scope=bot`;
                        } else {
                            link = redirectLink;
                        }
    
                        writeFile(link);
                        logger.log(`added ${link}`);
                        output.log(link);
                        totalScraped++;
                    } else {
                        logger.log(`top.gg response did not contain vanilla invite link for ${id}.`);
                        
                        if (config.ignorenonvanillainvitelinks) {
                            logger.log(`skipping because of configuration.`);
                        } else {
                            writeFile(redirectLink);
                            logger.log(`added ${redirectLink}`);
                            output.log(redirectLink);
                            totalScraped++;
                        };
                    }
                }

                await fetchData(skip + config.invitespersearchrequest);
            } else {
                logger.log('No more data to fetch.');
            }
        } catch (error) {
            logger.log(`Error fetching data: ${error}`);
            
            await fetchData(skip + config.invitespersearchrequest);
        }
    }

    fetchData();
})();