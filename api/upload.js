// api/upload.js — Vercel Serverless Function
// This proxies file uploads to Pinata so the JWT never touches the browser.

export const config = {
  api: {
    bodyParser: false, // We need raw multipart/form-data
  },
};

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const PINATA_JWT = process.env.PINATA_JWT;
  if (!PINATA_JWT) {
    return res.status(500).json({ error: "Server misconfiguration: PINATA_JWT not set" });
  }

  try {
    // Collect raw body chunks
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    // Forward the exact multipart body to Pinata
    const contentType = req.headers["content-type"];
    const pinataRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "Content-Type": contentType,
      },
      body: rawBody,
    });

    if (!pinataRes.ok) {
      const errText = await pinataRes.text();
      console.error("Pinata error:", errText);
      return res.status(pinataRes.status).json({ error: "Pinata upload failed", detail: errText });
    }

    const data = await pinataRes.json();
    return res.status(200).json({ IpfsHash: data.IpfsHash });
  } catch (err) {
    console.error("Upload proxy error:", err);
    return res.status(500).json({ error: "Internal server error", detail: err.message });
  }
}
