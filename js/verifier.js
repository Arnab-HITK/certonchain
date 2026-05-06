// js/verifier.js

// ─── Contract config ──────────────────────────────────────────────────────────
// Must match the address used in admin.js
const CONTRACT_ADDRESS = "0x3669FF365E03fb8de8d3E277F78B98e670d61Bc0";

const ABI = [
  {
    inputs: [
      { internalType: "bytes32", name: "certHash",    type: "bytes32" },
      { internalType: "string",  name: "studentName", type: "string"  },
      { internalType: "string",  name: "course",      type: "string"  },
      { internalType: "string",  name: "issueDate",   type: "string"  },
      { internalType: "string",  name: "ipfsHash",    type: "string"  },
    ],
    name: "issueCertificate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "certHash", type: "bytes32" }],
    name: "verifyCertificate",
    outputs: [
      { internalType: "string", name: "", type: "string" },
      { internalType: "string", name: "", type: "string" },
      { internalType: "string", name: "", type: "string" },
      { internalType: "string", name: "", type: "string" },
      { internalType: "bool",   name: "", type: "bool"   },
    ],
    stateMutability: "view",
    type: "function",
  },
];

// ─── Web3 init ────────────────────────────────────────────────────────────────
// verifyCertificate is a read-only (view) call — no wallet needed.
// We use a public Sepolia RPC so the page works even without MetaMask.
let web3;
let contract;

function initWeb3() {
  if (web3) return; // already initialised

  if (window.ethereum) {
    web3 = new Web3(window.ethereum);
  } else {
    // Fallback: read-only public RPC (Sepolia). Change if you're on mainnet.
    web3 = new Web3("https://rpc.sepolia.org");
  }

  contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
}

// ─── File validation ──────────────────────────────────────────────────────────
function validateFiles(files) {
  const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
  const maxSize = 3 * 1024 * 1024;
  const valid   = [];
  const invalid = [];

  for (const file of files) {
    if (!allowedTypes.includes(file.type)) {
      invalid.push(`❌ ${file.name} — Invalid file type`);
      continue;
    }
    if (file.size > maxSize) {
      invalid.push(`❌ ${file.name} — File too large (&gt;3 MB)`);
      continue;
    }
    valid.push(file);
  }

  return { valid, invalid };
}

// ─── SHA-256 hash ─────────────────────────────────────────────────────────────
async function generateSHA256(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const hashBuffer = await crypto.subtle.digest("SHA-256", reader.result);
        const hashHex = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        resolve(hashHex);
      } catch (e) {
        reject(new Error("Hashing failed"));
      }
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Main verify flow ─────────────────────────────────────────────────────────
async function verifyCertificates() {
  initWeb3();

  const input     = document.getElementById("verifyFile");
  const resultDiv = document.getElementById("verifyResult");
  const files     = Array.from(input.files);
  resultDiv.innerHTML = "";

  if (!files.length) {
    alert("Please select one or more files to verify.");
    return;
  }

  const { valid, invalid } = validateFiles(files);

  if (invalid.length) {
    resultDiv.innerHTML +=
      `<div class="mb-4"><strong>Invalid files:</strong><br>${invalid.join("<br>")}</div>`;
  }

  if (!valid.length) {
    resultDiv.innerHTML += "⚠️ No valid files to verify.";
    return;
  }

  for (const file of valid) {
    const entryId = "verify_" + file.name.replace(/\W/g, "_");
    resultDiv.innerHTML += `<div id="${entryId}" class="mb-4">
      <span class="spinner"></span> Verifying <strong>${file.name}</strong>…
    </div>`;

    try {
      const startTime = performance.now();

      const shaHash  = await generateSHA256(file);
      const certHash = web3.utils.keccak256(shaHash);
      const result   = await contract.methods.verifyCertificate(certHash).call();

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

     const name = result[0];
     const course = result[1];
     const date = result[2];
     const ipfs = result[3];
     const isValid = result[4];

      if (isValid) {
        document.getElementById(entryId).innerHTML = `
          <div class="border border-green-500 rounded p-3">
            ✅ <strong>${file.name}</strong> — <span class="text-green-400">Verified</span><br>
            👤 <strong>Name:</strong> ${name}<br>
            📘 <strong>Course:</strong> ${course}<br>
            📅 <strong>Issued On:</strong> ${date}<br>
            ⏱️ <strong>Verification Time:</strong> ${elapsed}s<br>
            🔗 <strong>IPFS:</strong>
               <a href="https://gateway.pinata.cloud/ipfs/${ipfs}" target="_blank"
                  class="text-blue-400 underline break-all">${ipfs}</a>
          </div>`;
      } else {
        document.getElementById(entryId).innerHTML = `
          <div class="border border-red-500 rounded p-3">
            ❌ <strong>${file.name}</strong> — <span class="text-red-400">Not found on blockchain</span><br>
            ⏱️ <strong>Verification Time:</strong> ${elapsed}s
          </div>`;
      }
    } catch (err) {
      console.error("Verification error:", err);
      document.getElementById(entryId).innerHTML = `
        <div class="border border-yellow-500 rounded p-3">
          ⚠️ <strong>${file.name}</strong> — Error: ${err.message}
        </div>`;
    }
  }
}

window.verifyCertificates = verifyCertificates;
