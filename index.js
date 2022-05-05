const express = require('express')
const app = express();
const port = process.env.PORT || 3000;
const fetch = require('node-fetch')
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const {getListingsPageData} = require('./functions')

app.use(express.static('public'));

app.listen(port, () => {
    console.log("Starting server on : http://localhost:" + port)
});

const linkType = {
    free: 'https://fnd.io/#/us/charts/iphone/top-free',
    paid: 'https://fnd.io/#/us/charts/iphone/top-paid',
    "new": 'https://fnd.io/#/us/charts/iphone/new'
}

/**
 * Gets top apps by: genre, free, paid, or new
 */
app.get('/api/top', (async (req, res) => {

    const {type, genre, loadAll} = req.query;
    let link = linkType[type];
    if (!genre)
        link += '/all'
    else link += `/${genre.toLowerCase()}`;


    if (!link) return res.end();

    const browser = await puppeteer.launch({
        'args': [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });
    const page = await browser.newPage();

    await page.goto(link , {waitUntil: 'networkidle2'});
    try{
        await page.waitForSelector('li', {visible: true, timeout: 30000})
    }catch {
        return res.send("Failed to load data")
    }

    if (loadAll === 'true')
        await autoScroll(page);

    const data = await getListingsPageData(page);
    res.json(data);
    await browser.close();

}));

app.get('/api/get', (async (req, response) => {//single app scraping by app trackID

    const {trackId} = req.query;
    const link = 'https://apps.apple.com/us/app/id'+trackId

    fetch(link).then(async res => {
        try {

            const data = await res.text();
            const $ = cheerio.load(data)
            const artworkUrl512 = $('picture source').attr('srcset').split(' ')[0]
            const screenshotUrls = $('ul.we-screenshot-viewer__screenshots-list li').map(function () {
                return $(this).find('source').first().attr('srcset').split(' ')[0]
            }).get();
            const formattedPrice = $('li.inline-list__item.inline-list__item--bulleted.app-header__list__item--price').text();
            const price = formattedPrice.toLowerCase() === 'free' ? 0 :
                Number(formattedPrice.substring(1));

            const cachedData = $('#shoebox-media-api-cache-apps')
            const text = cachedData.map(function (inx, el) {
                return el.children[0].data
            }).get(0)

            const parsedData = JSON.parse(Object.values(JSON.parse(text))[0]).d[0]

            const {
                id: trackId,
                attributes: {
                    artistName,
                    name: trackCensoredName,
                    userRating: {value: averageUserRating, ratingCount: userRatingCount},
                    fileSizeByDevice: {universal: fileSizeBytesNumeric},
                    platformAttributes: {ios: {description: {standard: description}, languageList, subtitle}},
                    contentRatingsBySystem: {appsApple: {name: contentAdvisoryRating}}

                },
                relationships: {
                    genres: {data: [primaryGenre]},
                    reviews: {data: reviews}
                }
            } = parsedData

            const appObj = {
                trackId,
                artworkUrl512,
                averageUserRating,
                userRatingCount,
                formattedPrice,
                price,
                description,
                fileSizeBytesNumeric,
                screenshotUrls,
                trackCensoredName,
                primaryGenreId: primaryGenre.id,
                lang: languageList[0],
                i18n_lang: languageList,
                subtitle,
                artistName,
                contentAdvisoryRating,
                reviews: reviews
            };

            return response.json(appObj);

        } catch (e) {
            response.json(['fail', e])
        }
    });


}))

/**
 * Way to search for apps by name,
 * Need webcrawling instead of webscraping because data loads after page is viewed
 */

app.get('/api/search', (async (req, res) => {

    const {text, allImages} = req.query;
    const loadAll = allImages === 'true'

    const browser = await puppeteer.launch({
        'args': [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });
    const page = await browser.newPage();

    await page.goto('https://fnd.io/#/us/search?mediaType=iphone&term=' + text, {waitUntil: 'networkidle2'})

    // try{
    //     await page.waitForSelector('li', {visible: true, timeout: 30000})
    // }catch {
    //     return res.send("Failed to load data")
    // }

    if (loadAll)
        await autoScroll(page);

    const data = await getListingsPageData(page);

    res.json(data);
    await browser.close();

}));

/**
 * Scrolls through a page to load more content
 * @param page the page to scroll through
 * @returns {Promise<void>}
 */


async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            let distance = 100;
            let timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}
