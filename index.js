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

// Middlewares Setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Function to generate a unique random short URL
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
    try {
      const existingUrl = await urls.findOne({
        shortUrl: randomShortUrl,
      });
      isUnique = !existingUrl;
    } catch (error) {
      console.error("Error checking for existing URL:", err);
    }
  }
  return randomShortUrl;
}

// Route to handle the root endpoint
app.get("/", (req, res) => {
  res.json({ greet: "helllo" });
});

// Route to handle short URL creation
app.post("/shorturl", async (req, res) => {
  const originalUrl = req.body.url;
  try {
    const hostname = urlParser.parse(originalUrl).hostname;

    // Use DNS lookup to validate the URL
    dns.lookup(hostname, async (err, address) => {
      let uniqueRandomShortUrl;
      if (!address) {
        res.json({ error: "INVALID_URL" });
      } else {
        // Check if the original URL already exists in the database
        const urlObj = await urls.findOne({ original_url: originalUrl });

        if (!urlObj) {
          // Generate a unique random short URL
          uniqueRandomShortUrl = await generateUniqueRandomShortUrl();
          const shortUrl = {
            original_url: originalUrl,
            short_url: uniqueRandomShortUrl,
          };

          // Insert the short URL into the database
          await urls.insertOne(shortUrl);
        }

        // Respond with the original and short URL
        res.json({
          original_url: originalUrl,
          short_url: `${req.protocol}://${req.get("host")}/${
            uniqueRandomShortUrl || urlObj.short_url
          }`,
        });
      }
    });
  } catch (error) {
    console.error("Error processing shorturl request:", error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

// Route to handle redirection based on short URL
app.get("/:short_url", async (req, res) => {
  const shortUrlParams = req.params.short_url;

  try {
    // Find the original URL associated with the short URL in the database
    const urlObj = await urls.findOne({ short_url: shortUrlParams });

    if (urlObj) {
      // Redirect to the original URL
      res.redirect(urlObj.original_url);
    } else {
      res.status(404).json({ error: "URL not found" });
    }
  } catch (error) {
    console.error("Error processing short_url request:", error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});
