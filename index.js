const express = require('express')
const app = express();
const port = process.env.PORT || 3000;
const cors = require('cors')({origin: true});
const cheerio = require('cheerio');
const fetch = require('node-fetch')

app.use(express.static('public'));

app.listen(port, () => {
    console.log("Starting server on : http://localhost:"+port)
});

app.get('/api', (async (req, res) => {

        console.log(fetch, req.query)
        const response = await fetch('https://fnd.io/#/us/search?mediaType=all&term='+req.query.text)
        const html = await response.text();
        const $ = cheerio.load(html);

        console.log(html)

        // const $ = cheerio.load();

        res.send("Hello World")

}))