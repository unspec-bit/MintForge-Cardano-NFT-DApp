import {
  Lucid,
  Constr,
  Blockfrost,
  Data,
  applyDoubleCborEncoding,
  applyParamsToScript,
  fromText,
  toHex,
} from "https://unpkg.com/lucid-cardano/web/mod.js";
import { uploadToIPFS } from "./lightHouse.js";

const preview = document.getElementById("preview");
const uploadButton = document.getElementById("uploadToIPFS");
const connectWalletButton = document.getElementById("connectWallet");
const walletStatus = document.getElementById("walletStatus");
const nftFile = document.getElementById("nftFile");
const mintButton = document.getElementById("mintNFT");

let lucid;
let walletConnected = false;
let connectedAddress = "";
let ipfsCID = "";

function hexToBytes(hex) {
  return hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16));
}

// collect wallet
connectWalletButton.addEventListener("click", async () => {
  try {
    // Initialize Lucid with Blockfrost for Preprod
    lucid = await Lucid.new(
      new Blockfrost(
        "https://cardano-preprod.blockfrost.io/api/v0",
        "preprod2gprBjgiRCdggMZFOUgPntHpvdBWIpUz",
      ),
      "Preprod",
    );
    // Connect Lace wallet to Lucid
    await lucid.selectWallet("lace");
    // Manually enable Lace
    const api = await window.cardano.lace.enable();

    // Get wallet address: used or change address
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

// Upload to Lighthouse Storage
uploadButton.addEventListener("click", async () => {
  if (!walletConnected) {
    console.error("Wallet is not connected");
    alert("Wallet is not connected");
    return;
  }

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

  const { cid, previewUrl } = await uploadToIPFS(file, name, desc);
  console.log(`Preview at: ${previewUrl}`);
  ipfsCID = cid;
  alert(`✅ Uploaded to IPFS: ${ipfsCID}\n✅ Preview at: ${previewUrl}`);
});

// Mint NFT button functionality

// 1. First ensure Lace wallet is properly detected
async function checkLaceWallet() {
  // Wait for wallet injection (some wallets take time)
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (typeof window === "undefined" || !window.cardano?.lace) {
    console.error("Lace wallet not detected in window.cardano");
    return false;
  }

  if (typeof window.cardano.lace.enable !== "function") {
    console.error("Lace wallet found, but `.enable()` is missing");
    return false;
  }

  return true;
}

function applyParams(tokname, outref, validator) {
  const outRef = new Constr(0, [
    new Constr(0, [outref.txHash]),
    BigInt(outref.outputIndex),
  ]);

  const token = applyParamsToScript(validator, [fromText(tokname), outRef]);

  const policyId = validatorToScriptHash({
    type: "PlutusV2",
    script: token,
  });

  return {
    redeem: { type: "PlutusV2", script: applyDoubleCborEncoding(token) },
    token: { type: "PlutusV2", script: applyDoubleCborEncoding(token) },
    policyId,
  };
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
      alert(
        "🔴 Lace wallet not detected. Please:\n1. Install Lace wallet\n2. Refresh page\n3. Ensure extension is enabled",
      );
      return;
    }

    // Initialize Lucid with Lace wallet
    const lucid = await Lucid.new(
      new Blockfrost(
        "https://cardano-preprod.blockfrost.io/api/v0",
        "preprod2gprBjgiRCdggMZFOUgPntHpvdBWIpUz",
      ),
      "Preprod",
    );

    // Enable wallet
    try {
      const laceApi = await window.cardano.lace.enable();
      await lucid.selectWallet(laceApi);
    } catch (err) {
      alert(
        "🔴 Wallet connection failed. Please:\n1. Unlock Lace wallet\n2. Check popup blocker\n3. Try again",
      );
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
    let addressDetails;
    try {
      addressDetails = lucid.utils.getAddressDetails(address);
      paymentCredential = addressDetails.paymentCredential;

      if (!paymentCredential?.hash)
        throw new Error("Missing payment credential");
      console.log("Payment credential hash:", paymentCredential.hash);
    } catch (err) {
      alert("❌ Invalid wallet address format");
      console.error("Credential error:", err);
      return;
    }

    const blueprint = await (await fetch("./plutus.json")).json();
    const mintforgeValidator = blueprint.validators[0];
    const tokenName = "WhatsApp Avatar";
    const utxos = await lucid.wallet.getUtxos();
    if (utxos.length == 0) {
      alert("No unused transactions in the wallet");
      return;
    }
    console.log("utxos:", utxos);
    const utxo = utxos[0];
    const outputReference = {
      txHash: utxo.txHash,
      outputIndex: utxo.outputIndex,
    };
    const contracts = applyParams(
      tokenName,
      outputReference,
      mintforgeValidator.compiledCode,
    );

    console.log(`contracts = ${contracts}`);

    //   const keyHash = addressDetails.paymentCredential.hash;

    //      // 2. Create simple policy script (wallet signature based)
    //     const policy = lucid.utils.nativeScriptFromJson({
    //       type: "sig",
    //       keyHash: keyHash,
    //     });

    //   const name = document.getElementById("nftName").value.trim();
    // const description = document.getElementById("nftDescription").value.trim();
    // const ipfsCID = "bafybeihsiw5icbnpzzvbopoq6p6e74jmo46juswrylekd6nzwamhokvlwe"; // example

    // const policyId = String(lucid.utils.mintingPolicyToId(policy));
    // const assetNameHex = String(toHex(fromText(name)));
    // const assetId = policyId + assetNameHex;

    // // ✅ Build metadata721 safely
    // const metadata721 = {
    //   [policyId]: {
    //     [assetNameHex]: {
    //       name: name,
    //       image: `ipfs://${ipfsCID}`,
    //       mediaType: "audio/mpeg",
    //       description: description,
    //     }
    //   }
    // };

    // // ✅ Build mintObj safely
    // const mintObj = {};
    // mintObj[assetId] = 1n;

    // console.log("✅ assetId:", assetId, typeof assetId);
    // console.log("✅ assetId hex valid:", /^[0-9a-f]+$/i.test(assetId));
    // console.log("✅ mintObj:", mintObj);
    // console.log("✅ metadata721:", metadata721);

    // // ✅ Final transaction
    // const tx = await lucid
    //   .newTx()
    //   .mintAssets(mintObj, policy)
    //   .attachMetadata(721, metadata721)
    //   .validTo(Date.now() + 3600000)
    //   .complete();

    //     const signedTx = await tx.sign().complete();
    //     const txHash = await signedTx.submit();

    //     console.log("✅ NFT Minted. Tx Hash:", txHash);
    //     alert(`✅ NFT Minted! Tx Hash:\n${txHash}`);
  } catch (err) {
    console.error("FINAL ERROR:", err);
    alert(
      `Minting failed: ${err.message || "Unknown error"}\n\nCheck console for details`,
    );
  } finally {
    mintButton.disabled = false;
    mintButton.textContent = "Mint NFT";
  }
});
