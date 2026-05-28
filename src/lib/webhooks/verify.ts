import crypto from "crypto";

export async function verifyCircleSignature(
  body: string,
  signature: string,
  keyId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.circle.com/v2/notifications/publicKey/${keyId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch Circle public key:", await response.text());
      return false;
    }

    const { data } = await response.json();
    const publicKeyPem = data?.publicKey;
    if (!publicKeyPem) {
      console.error("No publicKey in Circle response");
      return false;
    }

    const verifier = crypto.createVerify("SHA256");
    verifier.update(body, "utf8");
    verifier.end();

    return verifier.verify(
      publicKeyPem,
      Buffer.from(signature, "base64")
    );
  } catch (err) {
    console.error("Circle signature verification error:", err);
    return false;
  }
}
