/**
 * Gets searched information from fnd.io
 * @param page the page to search for
 * @returns {Promise<*>}
 */
module.exports.getListingsPageData = async (page) => {
    return await page.evaluate(() => {

        function getQuerySelector(inside, mappedFunction) {
            return Array.from(document.querySelectorAll(inside))
                .map(mappedFunction)
        }

        const titles = getQuerySelector('.ii-name', (i) => i.innerText)//app name
        const subtitles = getQuerySelector('.text-muted.ii-iimetadata', i => i.innerText)//app subtitle
        const icons = getQuerySelector('img.media-object', i => i.src)//app icon
        const regex = /\/\d+/m

        const appIDs = $('[title]').parent().parent('a').map(function () {//app track id
            return $(this)[0].href.match(regex)[0].substring(1)
        })

        let countArr = []
        Array.from($("span.ember-view.star-rating.star-rating"))//app star ratings
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

        const imgs = []//app preview images
        $('ul.ember-view.image-set-list').each(function () {
            imgs.push($(this).children().filter('li').find('img'))
        })
        const imgList = Array.from(imgs).map(i => Array.from(i).map(i => i.src))
        const links = $('a.btn.btn-itunes').map(function () {
            return this.href
        })


        return titles.map((i, index) => {//compile info into array object
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
}
