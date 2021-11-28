const express = require('express')
const app = express();
const port = process.env.PORT || 3000;
const cors = require('cors')({origin: true});
const cheerio = require('cheerio');
const fetch = require('node-fetch')
const puppeteer = require('puppeteer');
const {numbers, fileSize} = require('./converters')
const {getListingsPageData} = require('./functions')

app.use(express.static('public'));

app.listen(port, () => {
    console.log("Starting server on : http://localhost:" + port)
});

app.get('/api/top', (async (req, res) => {

    let link;
    const {type, genre, loadAll} = req.query;
    switch (type) {
        case 'free':
            link = 'https://fnd.io/#/us/charts/iphone/top-free';
            break;
        case 'paid':
            link = 'https://fnd.io/#/us/charts/iphone/top-paid';
            break;
        case 'new':
            link = 'https://fnd.io/#/us/charts/iphone/new';
            break;
    }
    if(!genre)
        link+='/all'
    else link+=`/${genre.toLowerCase()}`;

    if(!link) return res.end();

    const browser = await puppeteer.launch({
        'args': [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });
    const page = await browser.newPage();

    await page.goto(link);
    await page.waitForSelector('li', {visible: true})

    if(loadAll === 'true')
        await autoScroll(page);

    const data = await getListingsPageData(page);

    res.json(data);
    await browser.close();

}));

app.get('/api/get', (async (req, response) => {//single app scraping

    const trackId = req.query.trackId;
    const link = req.query.link || 'https://apps.apple.com/us/app/snapchat/id447188370?ign-mpt=uo%3D4';

    fetch(link).then(async res => {
        try {


            const data = await res.text();
            const $ = cheerio.load(data)
            const artworkUrl512 = $('picture source').attr('srcset').split(' ')[0]
            const trackCensoredName = $('h1.product-header__title').text().trim().split('\n')[0]
            const subtitle = $('h2.product-header__subtitle').text().trim();
            const ratings = $('figcaption.we-rating-count').text().split('•');
            const averageUserRating = ratings[0].trim();
            let userRatingCount = ratings[1].trim().split(' ')[0];
            userRatingCount = Number(userRatingCount.substring(0, userRatingCount.length - 1)) * numbers[userRatingCount.substring(userRatingCount.length - 1)]

            const formattedPrice = $('li.inline-list__item.inline-list__item--bulleted.app-header__list__item--price').text();
            const price = formattedPrice.toLowerCase() === 'free' ? 0 :
                Number(formattedPrice.substring(1));
            const descriptionP = $('div.we-truncate.we-truncate--multi-line.we-truncate--interactive p')
                .first()
            const description = $.html(descriptionP).replace(/(<p.*?>)(.*)(<\/p>)/, '$2').replace(/<br\s*[\/]?>/gi, "\n");

            const info = $('dt.information-list__item__term');
            const infoHeaders = info.map(function () {
                return ($(this).text())
            }).get();
            const infoDesc = info.map(function () {
                return ($(this).next().text().trim())
            }).get();
            const obj = {};
            infoHeaders.forEach((i, j) => obj[i] = infoDesc[j]);
            delete obj.Compatibility;
            delete obj.Location;
            delete obj.Copyright;
            delete obj['In-App Purchases']
            obj.Languages = obj.Languages.split(', ')
            obj['Age Rating'] = obj['Age Rating'].split('\n')[0]

            const i18n_lang = obj.Languages;
            const lang = i18n_lang[0];

            if (obj.Size) {
                const unit = obj.Size.substring(obj.Size.length - 2);
                const num = obj.Size.substring(0, obj.Size.length - 2);
                var fileSizeBytesNumeric = Number(num) * fileSize[unit];//first time actually using var with a reason
            }

            const artistName = obj.Seller;
            const primaryGenreId = obj.Category;
            const contentAdvisoryRating = obj['Age Rating'];

            const screenShotUrls = $('ul.we-screenshot-viewer__screenshots-list li').map(function () {
                return $(this).find('source').first().attr('srcset').split(' ')[0]
            }).get()

            const appObj = {
                trackId,
                artworkUrl512,
                averageUserRating,
                userRatingCount,
                formattedPrice,
                price,
                description,
                fileSizeBytesNumeric,
                screenShotUrls,
                trackCensoredName,
                primaryGenreId,
                lang,
                i18n_lang,
                subtitle,
                artistName,
                contentAdvisoryRating
            };

            return response.json(appObj);
        }catch(e){
            res.json(['fail', e])
        }

    })


}))

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

    await page.goto('https://fnd.io/#/us/search?mediaType=iphone&term=' + text)

    if (loadAll)
        await autoScroll(page);

    const data = await getListingsPageData(page);

    res.json(data);
    await browser.close();

}));


async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            let distance = 100;
            let timer = setInterval(() => {
                var scrollHeight = document.body.scrollHeight;
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