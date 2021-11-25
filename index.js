const express = require('express')
const app = express();
const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log("Starting server on : http://localhost:"+post)
});

app.get('/api', ((req, res) => {
    res("Hello World")
}))