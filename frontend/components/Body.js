import { useState } from "react";

async function onClickHandeler(urlInput, setShortUrl) {
  let urlResponse = await fetch("http://localhost:4000/shorturl", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: urlInput,
    }),
  });
  let urlData = await urlResponse.json();
  setShortUrl(urlData.short_url);
}

export const Body = () => {
  const [fullUrlInput, setFullUrlInput] = useState("");
  const [shortUrl, setShortUrl] = useState("");

  return (
    <div>
      <input
        type="text"
        placeholder="Enter URL"
        onChange={(e) => setFullUrlInput(e.target.value)}
      />
      <button onClick={() => onClickHandeler(fullUrlInput, setShortUrl)}>
        Short URL
      </button>
      <div>
        <p>Orignal URL : {fullUrlInput}</p>
        <p>Short URL : {shortUrl}</p>
      </div>
    </div>
  );
};
