export async function uploadToIPFS(file, name, description) {
  const apiKey = "b76bbf75d895f417f83c2b7db801f7a33de2fdf6."; // Your Lighthouse key

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("https://node.lighthouse.storage/api/v0/add", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    const result = await response.json();

    if (!result.Hash) {
      throw new Error("Lighthouse upload failed.");
    }

    // Manually build metadata (you can store this too if needed)
    const metadata = {
      name,
      description,
      image: `ipfs://${result.Hash}`,
    };

    return {
      cid: result.Hash,
      metadata,
      previewUrl: `https://gateway.lighthouse.storage/ipfs/${result.Hash}`,
    };
  } catch (error) {
    throw new Error("Upload failed: " + error.message);
  }
}
