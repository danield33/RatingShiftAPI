const express = require('express')
const app = express();
const port = process.env.PORT || 3000;
const cors = require('cors')({origin: true});
const cheerio = require('cheerio');
const fetch = require('node-fetch')
const puppeteer = require('puppeteer');
const {numbers, fileSize} = require('./converters')

app.use(express.static('public'));

app.listen(port, () => {
    console.log("Starting server on : http://localhost:" + port)
});

app.get('/api/get', (async (req, response) => {

    const trackId = req.query.trackId;
    const link = req.query.link || 'https://apps.apple.com/us/app/snapchat/id447188370?ign-mpt=uo%3D4';

    fetch(link).then(async res => {
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
        const infoHeaders = info.map(function (i, el) {
            return ($(this).text())
        }).get();
        const infoDesc = info.map(function (i, el) {
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

        const unit = obj.Size.substring(obj.Size.length - 2);
        const num = obj.Size.substring(0, obj.Size.length - 2);
        const fileSizeBytesNumeric = Number(num) * fileSize[unit];
        const artistName = obj.Seller;
        const primaryGenreId = obj.Category;

        const screenShotUrls = $('ul.we-screenshot-viewer__screenshots-list li').map(function () {
            return $(this).find('source').first().attr('srcset').split(' ')[0]
        }).get()

        console.log(artworkUrl512, 'hi');

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
            artistName
        };

        return response.json(appObj);

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

    const data = await page.evaluate(() => {

        function getQuerySelector(inside, mappedFunction) {
            return Array.from(document.querySelectorAll(inside))
                .map(mappedFunction)
        }

        const titles = getQuerySelector('.ii-name', (i) => i.innerText)
        const subtitles = getQuerySelector('.text-muted.ii-iimetadata', i => i.innerText)
        const icons = getQuerySelector('img.media-object', i => i.src)
        const regex = /\/\d+/m
        const appIDs = $('[title]').parent().parent('a').map(function () {
            return $(this)[0].href.match(regex)[0].substring(1)
        })

        let countArr = []
        Array.from($("span.ember-view.star-rating.star-rating"))
            .map(i => i.childNodes)
            .map(i => Array.from(i)
                .map(i => i.classList))
            .map(i => Array.from(i)
                .map(i => i[1]))
            .forEach(i => {
                let counts = {}

                i.forEach(j => {
                    counts[j] = (counts[j] || 0) + 1
                });
                let total = 0;
                total += counts['fa-star'];
                total += counts['fa-star-half-o'] * .5
                countArr.push(total);
            });

        const imgs = []
        $('ul.ember-view.image-set-list').each(function () {
            imgs.push($(this).children().filter('li').find('img'))
        })
        const imgList = Array.from(imgs).map(i => Array.from(i).map(i => i.src))
        const links = $('a.btn.btn-itunes').map(function () {
            return this.href
        })


        return titles.map((i, index) => {
            return {
                trackCensoredName: i,
                subtitle: subtitles[index],
                artworkUrl512: icons[index],
                averageUserRating: countArr[index],
                screenshotUrls: imgList[index],
                trackId: appIDs[index],
                link: links[index]
            }
        });
    })

    await browser.close();

    res.json(data);


}));


async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
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