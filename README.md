# CertOnChain — Deployment Guide

A blockchain-based certificate issuance & verification platform using Ethereum, IPFS (Pinata), and MetaMask.

---

## Project Structure

```
certchain/
├── index.html          ← Landing page
├── admin_new.html      ← Admin portal (issue certificates)
├── verifier.html       ← Verifier portal (verify certificates)
├── js/
│   ├── admin.js        ← Admin logic (uploads via /api/upload proxy)
│   └── verifier.js     ← Verifier logic (read-only blockchain calls)
├── api/
│   └── upload.js       ← Vercel serverless function (Pinata proxy)
├── test2.sol           ← Solidity smart contract (for reference)
├── vercel.json         ← Vercel deployment config
├── .env.example        ← Environment variable template
├── .gitignore
└── README.md
```

---

## Before You Deploy

### 1. Rotate your Pinata JWT

Your old JWT was exposed in client-side code. **Revoke it immediately:**

1. Go to [app.pinata.cloud/keys](https://app.pinata.cloud/keys)
2. Find your existing key → click **Revoke**
3. Click **New Key** → give it a name → copy the JWT

### 2. Check your contract address

Both `js/admin.js` and `js/verifier.js` use:
```
0x3669FF365E03fb8de8d3E277F78B98e670d61Bc0
```
Make sure this matches your deployed contract. If you redeploy the contract, update both files.

---

## Deploy to Vercel (Recommended)

### Step 1 — Push to GitHub

```bash
cd certchain
git init
git add .
git commit -m "Initial commit"
```

Go to [github.com/new](https://github.com/new), create a repo, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/certchain.git
git branch -M main
git push -u origin main
```

### Step 2 — Import on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New Project**
3. Select your `certchain` repository
4. Leave framework as **Other** (it's a static site + serverless function)
5. Click **Deploy**

### Step 3 — Add your Pinata JWT as an Environment Variable

1. In your Vercel project → **Settings** → **Environment Variables**
2. Add:
   - **Name:** `PINATA_JWT`
   - **Value:** your new Pinata JWT (without the `Bearer ` prefix — the code adds that)
   - **Environment:** Production, Preview, Development (tick all three)
3. Click **Save**
4. Go to **Deployments** → click the three dots on your latest deploy → **Redeploy**

Your site is now live. Vercel gives you a URL like `https://certchain-abc.vercel.app`.

---

## Local Development

```bash
# Install Vercel CLI
npm install -g vercel

# Create your local env file
cp .env.example .env.local
# Edit .env.local and paste your real PINATA_JWT

# Run locally (serves HTML + the /api/upload serverless function)
vercel dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How the Security Fix Works

**Before (broken):** `admin.js` sent your Pinata JWT directly from the browser:
```
Browser → Pinata API (JWT visible in Network tab to anyone)
```

**After (fixed):** The browser calls your own serverless function:
```
Browser → /api/upload (your server) → Pinata API (JWT never leaves server)
```

The JWT is stored as a Vercel environment variable — it never appears in your HTML or JS files.

---

## Updating the Contract Address

If you redeploy the smart contract:

1. Edit `js/admin.js` line 3: `const CONTRACT_ADDRESS = "0xNEW_ADDRESS";`
2. Edit `js/verifier.js` line 3: `const CONTRACT_ADDRESS = "0xNEW_ADDRESS";`
3. Commit and push — Vercel redeploys automatically.

---

## Network

The contract is deployed on **Sepolia testnet** (based on your contract address).  
Make sure MetaMask is set to **Sepolia** when using the Admin portal.  
The Verifier portal works without MetaMask (uses a public Sepolia RPC fallback).
