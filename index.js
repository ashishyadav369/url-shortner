require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const dns = require("dns");
const urlParser = require("url");

const app = express();
const port = process.env.PORT || 3000;

const client = new MongoClient(process.env.DB_URL);
const dbName = process.env.DB_NAME;
const db = client.db(dbName);
const urls = db.collection("urls");

// Database connection
async function connectToDatabase() {
  try {
    await client.connect();
    console.log("Connected to the database");
  } catch (error) {
    console.error("Error connecting to the database:", error);
  }
}

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
        short_url: randomShortUrl,
      });
      isUnique = !existingUrl;
    } catch (error) {
      console.error("Error checking for existing URL:", err);
    }
  }
  return randomShortUrl;
}

// Function to delete expired short URLs
async function deleteExpiredUrls() {
  try {
    const currentDate = new Date();
    const expiredUrls = await urls.deleteMany({
      expiration_at: { $lt: currentDate },
    });
    console.log(`Deleted ${expiredUrls.deletedCount} expired Urls`);
  } catch (error) {
    console.error("Error deleting expired urls", error);
  }
}

// Route to handle the root endpoint
app.get("/", async (req, res) => {
  res.json({ greet: "hello" });
});

// Route to handle short URL creation
app.post("/shorturl", async (req, res) => {
  const originalUrl = req.body.url;
  try {
    const hostname = urlParser.parse(originalUrl).hostname;

    // Use DNS lookup to validate the URL
    const isValidAddress = await new Promise((resolve, reject) => {
      dns.lookup(hostname, (err, address) => {
        if (err) reject(err);
        resolve(address);
      });
    });

    if (!isValidAddress) {
      res.json({ error: "INVALID_URL" });
    } else {
      // Check if the original URL already exists in the database
      const urlObj = await urls.findOne({ original_url: originalUrl });
      let uniqueRandomShortUrl;

      if (!urlObj) {
        // Generate a unique random short URL
        uniqueRandomShortUrl = await generateUniqueRandomShortUrl();

        let createdAt = new Date();
        let expirationDate = new Date(createdAt);
        expirationDate.setMonth(expirationDate.getMonth() + 3);

        const shortUrl = {
          original_url: originalUrl,
          short_url: uniqueRandomShortUrl,
          created_at: createdAt,
          expiration_at: expirationDate,
        };

        // Insert the short URL into the database
        await urls.insertOne(shortUrl);
      }

      // Respond with the original and short URL
      res.json({
        original_url: originalUrl,
        short_url: `${req.protocol}://${req.get("host")}/${
          urlObj ? urlObj.short_url : uniqueRandomShortUrl
        }`,
      });
    }
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

// Periodic task to delete expired URLs every 24hr
setInterval(async () => {
  await deleteExpiredUrls();
}, 24 * 60 * 60 * 1000); // 24hr in ms

connectToDatabase().then(() => {
  app.listen(port, function () {
    console.log(`Listening on port ${port}`);
  });
});
