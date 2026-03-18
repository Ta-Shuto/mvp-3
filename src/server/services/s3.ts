/**
 * S3-compatible file storage service (works with AWS S3 and MinIO)
 */

interface S3Config {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
}

function getConfig(): S3Config {
  return {
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    accessKey: process.env.S3_ACCESS_KEY ?? "minioadmin",
    secretKey: process.env.S3_SECRET_KEY ?? "minioadmin",
    bucket: process.env.S3_BUCKET ?? "interview-support",
    region: process.env.S3_REGION ?? "ap-northeast-1",
  };
}

function hmacSha256(key: ArrayBuffer | string, data: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const keyData = typeof key === "string" ? enc.encode(key) : key;
  return crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((k) => crypto.subtle.sign("HMAC", k, enc.encode(data)));
}

async function sha256(data: string | ArrayBuffer): Promise<string> {
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate = await hmacSha256("AWS4" + key, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

async function signRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  payloadHash: string,
  config: S3Config
): Promise<SignedRequest> {
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, "").slice(0, 8);
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z/, "Z");
  const region = config.region ?? "ap-northeast-1";

  const url = new URL(path, config.endpoint);
  headers["host"] = url.host;
  headers["x-amz-date"] = amzDate;
  headers["x-amz-content-sha256"] = payloadHash;

  const signedHeaderKeys = Object.keys(headers).sort().map((k) => k.toLowerCase());
  const signedHeaders = signedHeaderKeys.join(";");
  const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${headers[k]}`).join("\n") + "\n";

  const canonicalRequest = [method, url.pathname, url.search.slice(1), canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, await sha256(canonicalRequest)].join("\n");
  const signingKey = await getSignatureKey(config.secretKey, dateStamp, region, "s3");
  const signatureBuf = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

  headers["authorization"] = `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { url: url.toString(), headers };
}

/**
 * Upload a file to S3
 */
export async function uploadFile(
  key: string,
  body: ArrayBuffer,
  contentType: string
): Promise<{ key: string; url: string }> {
  const config = getConfig();
  const path = `/${config.bucket}/${key}`;
  const payloadHash = await sha256(body);

  const headers: Record<string, string> = {
    "content-type": contentType,
    "content-length": String(body.byteLength),
  };

  const signed = await signRequest("PUT", path, headers, payloadHash, config);

  const response = await fetch(signed.url, {
    method: "PUT",
    headers: signed.headers,
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`S3 upload failed: ${response.status} ${text}`);
  }

  return { key, url: `${config.endpoint}/${config.bucket}/${key}` };
}

/**
 * Generate a presigned-like download URL (redirect through API)
 */
export function getDownloadPath(key: string): string {
  return `/api/files/download?key=${encodeURIComponent(key)}`;
}

/**
 * Download a file from S3
 */
export async function downloadFile(key: string): Promise<{ body: ArrayBuffer; contentType: string }> {
  const config = getConfig();
  const path = `/${config.bucket}/${key}`;
  const payloadHash = await sha256("");

  const headers: Record<string, string> = {};
  const signed = await signRequest("GET", path, headers, payloadHash, config);

  const response = await fetch(signed.url, { headers: signed.headers });

  if (!response.ok) {
    throw new Error(`S3 download failed: ${response.status}`);
  }

  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}

/**
 * Delete a file from S3
 */
export async function deleteFile(key: string): Promise<void> {
  const config = getConfig();
  const path = `/${config.bucket}/${key}`;
  const payloadHash = await sha256("");

  const headers: Record<string, string> = {};
  const signed = await signRequest("DELETE", path, headers, payloadHash, config);

  const response = await fetch(signed.url, { method: "DELETE", headers: signed.headers });

  if (!response.ok) {
    throw new Error(`S3 delete failed: ${response.status}`);
  }
}
