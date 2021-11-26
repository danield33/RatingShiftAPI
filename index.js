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

app.get('/api', (async (req, res) => {

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });
    const page = await browser.newPage();

    await page.goto('https://fnd.io/#/us/search?mediaType=iphone&term=' + req.query.text)

    console.log(1)
    await page.waitForSelector('li', {visible: true})
    console.log(2)
    await page.setViewport({
        width: 1200,
        height: 10000
    });
    console.log(3)

    // await autoScroll(page);
    console.log(4)

    // await page.screenshot({
    //     path: '1.png',
    //     fullPage: true
    // })

    const data = await page.evaluate(() => {

        function getQuerySelector(inside, mappedFunction) {
            return Array.from(document.querySelectorAll(inside))
                .map(mappedFunction)
        }

        const titles = getQuerySelector('.ii-name', (i) => i.innerText)
        const subtitles = getQuerySelector('.text-muted.ii-iimetadata', i => i.innerText)
        const icons = getQuerySelector('img.media-object', i => i.src)

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
                total += counts['fa-star-half-o']*.5
                countArr.push(total);
            });

        const imgs = [];
        $('ul.ember-view.image-set-list').each(function(){
            imgs.push($(this).children().filter('li').find('img'))
        })
        const imgList = Array.from(imgs).map(i => Array.from(i).map(i => i.src))


        return titles.map((i, index) => {
            return {
                trackCensoredName: i,
                subtitle: subtitles[index],
                artworkUrl512: icons[index],
                averageUserRating: countArr[index],
                screenshotUrls: imgList[index]
            }
        });
    })

    console.log(data.length)
    await browser.close();

    res.write(JSON.stringify(data));

    res.write('HELLO THERE')


}));


async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
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