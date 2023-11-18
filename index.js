require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient } = require("mongodb");
const dns = require("dns");
const urlParser = require("url");

const client = new MongoClient(process.env.DB_URL);
const db = client.db("urlshortner");
const urls = db.collection("urls");

const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function generateUniqueRandomShortUrl(length = 6) {
  const characters =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let isUnique = false;
  let randomShortUrl;

  while (!isUnique) {
    randomShortUrl = "";
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      randomShortUrl += characters.charAt(randomIndex);
    }

    // Check if the generated short URL is unique
    const existingUrl = await urls.findOne({
      shortUrl: randomShortUrl,
    });
    isUnique = !existingUrl;
  }
  return randomShortUrl;
}

app.post("/shorturl", async (req, res) => {
  const orignalUrl = req.body.url;
  dns.lookup(urlParser.parse(orignalUrl).hostname, async (err, address) => {
    if (!address) {
      req.json({ error: "INVALID_URL" });
    } else {
      const uniqueRandomShortUrl = await generateUniqueRandomShortUrl();
      const shortUrl = {
        orignalUrl,
        shortUrl: uniqueRandomShortUrl,
      };
      await urls.insertOne(shortUrl);
      res.json({
        orignal_url: orignalUrl,
        short_url: `${req.protocol}://${req.get(
          "host"
        )}/${uniqueRandomShortUrl}`,
      });
    }
  });
});
app.get("/:short_url", async (req, res) => {
  const shortUrlParams = req.params.short_url;
  console.log(shortUrlParams);
  const urlObj = await urls.findOne({ shortUrl: shortUrlParams });
  console.log(urlObj);
  res.redirect(urlObj.orignalUrl);
});

app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});
