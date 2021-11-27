const express = require('express')
const app = express();
const port = process.env.PORT || 3000;
const cors = require('cors')({origin: true});
const cheerio = require('cheerio');
const fetch = require('node-fetch')
const puppeteer = require('puppeteer');

app.use(express.static('public'));

app.listen(port, () => {
    console.log("Starting server on : http://localhost:" + port)
});

async function wait(time = 5000) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(true)
        }, time)
    })
}

app.get('/api/get', (async (req, res) => {

    const {link} = req.query || 'https://apps.apple.com/us/app/snapchat/id447188370?ign-mpt=uo%3D4';

    const browser = await puppeteer.launch({
        'args': [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });
    const page = await browser.newPage();
    await page.goto(link)

    await page.screenshot({fullPage: true, path: '2.png'})

    const data = await page.evaluate(() => {

        const icon = $('.ii-icon.iphone-app.app.ios').last().attr('src');
        const name = $($('span[title]')[1].childNodes)[0].data;
        const subText = $('span.text-muted');
        const developer = $(subText[1]).find('a')[0].outerText;
        const ratingCount = subText[0].innerText;
        const subtitle = $('div.ii-metadata1-row').get(1).innerText;
        const description = $('div.preformatted-text').first().text();
        const formattedPrice = $('a.btn.btn-itunes').text().trim();
        const price = formattedPrice.toLowerCase() === 'free' ? 0 : Number(formattedPrice.substring(1))
        const avgRating = $('span.fa').map(function(){
            return $(this).attr('class')}).toArray().reduce((prev, curr) => {
            if (curr === 'fa fa-star') {
                return prev + 1;
            }else if(curr === 'fa fa-star-half-o')
                return prev + .5;
        }, 0);

        const screenShotUrls = $('ul.ember-view li img').map(function(){
            return $(this).attr('src')
        }).toArray();





    });

    res.send(data)

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
        const links = $('a.btn.btn-itunes').map(function(){return this.href})


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