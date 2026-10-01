import "server-only";
import { createSign } from "node:crypto";

// Minimal Google service-account auth (no SDK): sign a JWT, swap it for an access token,
// then export the media report Google Sheet as .xlsx through the Drive API.

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

export function serviceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    // Accept the JSON key as pasted, or base64-encoded.
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const k = JSON.parse(json);
    if (!k.client_email || !k.private_key) return null;
    return { client_email: k.client_email, private_key: k.private_key };
  } catch {
    return null;
  }
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`Google sign-in failed: ${body.error_description || body.error || res.status}`);
  return body.access_token as string;
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Download the Google Sheet as an .xlsx file, plus its title and last-modified time. */
export async function exportSheet(fileId: string) {
  const sa = serviceAccount();
  if (!sa) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY isn't set in Vercel, so the sheet can't be read.");
  const token = await accessToken(sa);
  const auth = { Authorization: `Bearer ${token}` };
  const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=name,modifiedTime&supportsAllDrives=true`, {
    headers: auth,
    signal: AbortSignal.timeout(10000),
  });
  if (meta.status === 404 || meta.status === 403)
    throw new Error(`The sheet isn't shared with ${sa.client_email}. Share it with that address as a Viewer.`);
  if (!meta.ok) throw new Error(`Google Drive returned ${meta.status} reading the sheet.`);
  const { name, modifiedTime } = (await meta.json()) as { name: string; modifiedTime: string };
  const file = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(XLSX_MIME)}`,
    { headers: auth, signal: AbortSignal.timeout(30000) },
  );
  if (!file.ok) throw new Error(`Google Drive returned ${file.status} exporting the sheet.`);
  return { name, modifiedTime, buf: new Uint8Array(await file.arrayBuffer()), serviceEmail: sa.client_email };
}
