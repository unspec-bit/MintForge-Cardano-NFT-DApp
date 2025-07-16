import { Lucid, Blockfrost,fromText } from "https://unpkg.com/lucid-cardano/web/mod.js";


 const preview = document.getElementById("preview");
//  const nftName = document.getElementById("nftName");
//  const nftDescription = document.getElementById("nftDescription");
 const uploadButton = document.getElementById("uploadToIPFS");
//  const resultDisplay = document.getElementById("ipfsResult");
const connectWalletButton= document.getElementById('connectWallet');
const walletStatus = document.getElementById('walletStatus');
const nftFile = document.getElementById('nftFile');
const mintButton= document.getElementById("mintNFT")
let lucid;
let walletConnected = false;
let connectedAddress = "";
let ipfsCID = "";


function hexToBytes(hex) {
  return hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16));
}


function toHex(bytes) {
  return [...bytes].map(x => x.toString(16).padStart(2, "0")).join("");
}

// const wallet = new MeshWallet({ walletName: "nami" });
// await wallet.enable();
// const address = await wallet.getUsedAddress();
// walletStatus.textContent = `Wallet connected: ${address}`;




// collect wallet
connectWalletButton.addEventListener("click", async () => {
  try {
    lucid = await Lucid.new(
      new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", "preprod2gprBjgiRCdggMZFOUgPntHpvdBWIpUz"),
      "Preprod"
    );

    await lucid.selectWallet("lace");

    const api = await window.cardano.lace.enable();

    let hexAddress;
    const usedAddresses = await api.getUsedAddresses();
    if (usedAddresses && usedAddresses.length > 0) {
      hexAddress = usedAddresses[0];
    } else {
      hexAddress = await api.getChangeAddress();
    }

    if (!hexAddress) throw new Error("No address returned from wallet");

const address = hexAddress; // using it directly
walletConnected = true;
connectedAddress = address;
  
    walletStatus.textContent = `✅ Connected: ${address}`;
  } catch (e) {
    walletStatus.textContent = "❌ Wallet connection failed";
    console.error("Wallet connection failed:", e);
  }
});



  //   lucid.selectWallet(walletApi);

  

 
// Upload to Lighthouse Storage
uploadButton.addEventListener("click", async () => {
  const fileInput = document.getElementById("nftFile");
  const nameInput = document.getElementById("nftName");
  const descInput = document.getElementById("nftDescription");

  const file = fileInput.files[0];
  const name = nameInput.value.trim();
  const desc = descInput.value.trim();

  if (!file || !name || !desc) {
    alert("❌ Please fill all fields and upload a file");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("https://node.lighthouse.storage/api/v0/add", {
      method: "POST",
      headers: {
      Authorization: "Bearer bde2fdf6.76bbf75d895f417f83c2b7db801f7a33",
      },
      body: formData,
    });

    const text = await res.text();
    console.log("Lighthouse response text:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error("Invalid JSON returned by Lighthouse");
    }

    if (!data.Hash) throw new Error("Upload failed");

    ipfsCID = data.Hash;
    alert(`✅ Uploaded to IPFS: ${ipfsCID}`);
  } catch (err) {
    alert("❌ Upload failed: " + err.message);
    console.error("❌ Upload failed:", err);
  }
});


//     // Show preview image if it's an image
//     if (file.type.startsWith("image/")) {
//       const preview = document.getElementById("previewImage");
//       preview.src = result.previewUrl;
//       preview.style.display = "block";
//     }
//   } catch (error) {
//     alert("❌ Upload failed: " + error.message);
//   }
// });



// Mint NFT button functionality

// 1. First ensure Lace wallet is properly detected
async function checkLaceWallet() {
  // Wait for wallet injection (some wallets take time)
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (typeof window === 'undefined' || !window.lace) {
    console.error("Lace wallet not detected in window object");
    return false;
  }
  
  try {
    // Double-check enable method exists
    if (typeof window.lace.enable !== 'function') {
      console.error("Lace.enable is not a function");
      return false;
    }
    return true;
  } catch (err) {
    console.error("Wallet detection error:", err);
    return false;
  }
}

// 2. Main minting function
document.getElementById("mintNFT").addEventListener("click", async () => {
  const mintButton = document.getElementById("mintNFT");
  
  try {
    // Disable button during processing
    mintButton.disabled = true;
    mintButton.textContent = "Processing...";
    
    // Verify Lace wallet
    const walletAvailable = await checkLaceWallet();
    if (!walletAvailable) {
      alert("🔴 Lace wallet not detected. Please:\n1. Install Lace wallet\n2. Refresh page\n3. Ensure extension is enabled");
      return;
    }

    // Initialize Lucid with Lace wallet
    const lucid = await Lucid.new(
      new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", "your_blockfrost_key"),
      "Preprod"
    );
    
    // Enable wallet
    try {
      await window.lace.enable();
      lucid.selectWallet("lace");
    } catch (err) {
      alert("🔴 Wallet connection failed. Please:\n1. Unlock Lace wallet\n2. Check popup blocker\n3. Try again");
      console.error("Wallet enable error:", err);
      return;
    }

    // Get wallet address
    let address;
    try {
      address = await lucid.wallet.address();
      if (!address) throw new Error("Empty address returned");
      console.log("Connected address:", address);
    } catch (err) {
      alert("⚠️ Couldn't get wallet address. Try reconnecting.");
      console.error("Address error:", err);
      return;
    }

    // Get payment credential
    let paymentCredential;
    try {
      const addressDetails = lucid.utils.getAddressDetails(address);
      paymentCredential = addressDetails.paymentCredential;
      if (!paymentCredential?.hash) throw new Error("Missing payment credential");
      console.log("Payment credential hash:", paymentCredential.hash);
    } catch (err) {
      alert("❌ Invalid wallet address format");
      console.error("Credential error:", err);
      return;
    }

    // [Rest of your minting code...]
    // Include all the validation and minting logic from previous examples
    
  } catch (err) {
    console.error("FINAL ERROR:", err);
    alert(`Minting failed: ${err.message || "Unknown error"}\n\nCheck console for details`);
  } finally {
    mintButton.disabled = false;
    mintButton.textContent = "Mint NFT";
  }
});