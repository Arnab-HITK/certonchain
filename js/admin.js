// js/admin.js

// ─── Contract config ────────────────────────────────────────────────────────
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

let web3, account, contract;

// ─── Wallet ──────────────────────────────────────────────────────────────────
async function connectWallet() {
  const walletStatus = document.getElementById("walletStatus");

  if (!window.ethereum) {
    walletStatus.innerText = "❌ MetaMask not detected. Please install MetaMask.";
    return;
  }

  try {
    web3 = new Web3(window.ethereum);
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    account = accounts[0];
    contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);

    walletStatus.innerText = `✅ Connected: ${account}`;
    document.getElementById("connectBtn").style.display = "none";
    document.getElementById("adminSection").style.display = "block";
  } catch (err) {
    console.error("Wallet connection failed", err);
    walletStatus.innerText = "❌ Connection failed. Please try again.";
  }
}

// ─── File validation ─────────────────────────────────────────────────────────
function validateFiles() {
  const fileInput = document.getElementById("certFiles");
  const fileError = document.getElementById("fileError");
  const files = Array.from(fileInput.files);
  fileError.innerHTML = "";

  const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
  const maxSize = 3 * 1024 * 1024; // 3 MB
  const validFiles = [];

  if (!files.length) {
    fileError.innerHTML = "❗ Please select at least one file.";
    return [];
  }

  let messages = "";
  for (const file of files) {
    if (!allowedTypes.includes(file.type)) {
      messages += `❌ ${file.name} — Invalid file type<br>`;
      continue;
    }
    if (file.size > maxSize) {
      messages += `❌ ${file.name} — File too large (&gt;3 MB)<br>`;
      continue;
    }
    messages += `✅ ${file.name} — Valid<br>`;
    validFiles.push(file);
  }

  fileError.innerHTML = messages;
  return validFiles;
}

// ─── SHA-256 hash ─────────────────────────────────────────────────────────────
async function sha256File(file) {
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
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error("Error reading file"));
    reader.readAsArrayBuffer(file);
  });
}

// ─── IPFS upload — goes through /api/upload (JWT stays server-side) ──────────
async function uploadToIPFS(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (!data.IpfsHash) throw new Error("No IPFS hash returned from server");
  return data.IpfsHash;
}

// ─── Issue certificate ────────────────────────────────────────────────────────
async function issueCertificate() {
  const validFiles = validateFiles();
  const resultDiv  = document.getElementById("issueResult");
  resultDiv.innerHTML = "";

  const studentName = document.getElementById("studentName").value.trim();
  const course      = document.getElementById("course").value.trim();
  const issueDate   = document.getElementById("issueDate").value;

  if (!studentName || !course || !issueDate) {
    alert("❗ All student details are required.");
    return;
  }

  if (!validFiles.length) {
    resultDiv.innerHTML = "❌ No valid files to process.";
    return;
  }

  for (const file of validFiles) {
    const entryId = "issue_" + file.name.replace(/\W/g, "_");
    resultDiv.innerHTML += `<div id="${entryId}"><span class="spinner"></span> Processing <strong>${file.name}</strong>…</div>`;

    try {
      // 1. Hash the file
      const shaHash  = await sha256File(file);
      const certHash = web3.utils.keccak256(shaHash);

      // 2. Check if already issued
      setStatus(entryId, `<span class="spinner"></span> Checking <strong>${file.name}</strong> on-chain…`);
      const existing = await contract.methods.verifyCertificate(certHash).call();
      if (existing[4]) {
        setStatus(entryId,
          `❌ <strong>${file.name}</strong> — Already issued to <em>${existing[0]}</em> on ${existing[2]}<br>` +
          `🔗 <a href="https://gateway.pinata.cloud/ipfs/${existing[3]}" target="_blank">${existing[3]}</a>`
        );
        continue;
      }

      // 3. Upload to IPFS (via server proxy)
      setStatus(entryId, `<span class="spinner"></span> Uploading <strong>${file.name}</strong> to IPFS…`);
      const ipfsHash = await uploadToIPFS(file);

      // 4. Send blockchain transaction
      setStatus(entryId, `<span class="spinner"></span> Waiting for MetaMask confirmation for <strong>${file.name}</strong>…`);

      const txPromise = contract.methods
        .issueCertificate(certHash, studentName, course, issueDate, ipfsHash)
        .send({ from: account });

      txPromise.once("transactionHash", () => {
        setStatus(entryId, `<span class="spinner"></span> Transaction submitted for <strong>${file.name}</strong>… waiting for confirmation`);
      });

      const receipt = await txPromise;

      setStatus(entryId,
        `✅ <strong>${file.name}</strong> issued successfully<br>` +
        `🔗 <strong>Tx:</strong> <code>${receipt.transactionHash}</code><br>` +
        `📄 <strong>IPFS:</strong> <a href="https://gateway.pinata.cloud/ipfs/${ipfsHash}" target="_blank">${ipfsHash}</a>`
      );
    } catch (err) {
      console.error(`Error issuing ${file.name}:`, err);
      setStatus(entryId, `❌ <strong>${file.name}</strong> — ${err.message}`);
    }
  }
}

function setStatus(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("certFiles");
  if (fileInput) fileInput.addEventListener("change", validateFiles);
});
