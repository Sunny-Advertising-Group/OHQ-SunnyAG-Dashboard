import "server-only";
import { createSign } from "node:crypto";

// Minimal Google service-account auth (no SDK): sign a JWT, swap it for an access token,
// then export the media report Google Sheet as .xlsx through the Drive API.

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

/**
 * Reads GOOGLE_SERVICE_ACCOUNT_KEY. Accepts the downloaded JSON key as pasted (with or
 * without surrounding quotes), or base64 of it. Returns a plain-English problem if it
 * can't be used, so Admin can show exactly what to fix.
 */
export function readServiceAccount(): { sa: ServiceAccount | null; problem?: string } {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw || !raw.trim()) return { sa: null, problem: "GOOGLE_SERVICE_ACCOUNT_KEY isn't set in Vercel (Production)." };
  raw = raw.trim();
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"') && !raw.startsWith('"{'))) raw = raw.slice(1, -1).trim();
  let text = raw;
  if (!raw.startsWith("{")) {
    try {
      const decoded = Buffer.from(raw, "base64").toString("utf8").trim();
      if (decoded.startsWith("{")) text = decoded;
    } catch {}
  }
  if (!text.startsWith("{")) {
    if (raw.includes("BEGIN PRIVATE KEY"))
      return { sa: null, problem: "GOOGLE_SERVICE_ACCOUNT_KEY holds only the private key. Paste the whole downloaded .json file, from { to }." };
    if (/@.*\.iam\.gserviceaccount\.com$/.test(raw))
      return { sa: null, problem: "GOOGLE_SERVICE_ACCOUNT_KEY holds the service account email. Paste the whole downloaded .json key file instead." };
    return { sa: null, problem: "GOOGLE_SERVICE_ACCOUNT_KEY isn't the JSON key file. Paste the whole downloaded .json file, from { to }." };
  }
  let k: Record<string, unknown>;
  try {
    k = JSON.parse(text);
  } catch {
    return { sa: null, problem: "GOOGLE_SERVICE_ACCOUNT_KEY looks cut off or edited (it isn't valid JSON). Paste the whole .json file again." };
  }
  if (typeof k.client_email !== "string" || typeof k.private_key !== "string")
    return { sa: null, problem: "GOOGLE_SERVICE_ACCOUNT_KEY is JSON but not a service account key (no client_email / private_key). Use Keys → Add key → JSON." };
  // Keys pasted with literal "\n" sequences still work.
  const private_key = (k.private_key as string).includes("\\n") ? (k.private_key as string).replace(/\\n/g, "\n") : (k.private_key as string);
  return { sa: { client_email: k.client_email, private_key } };
}

export function serviceAccount(): ServiceAccount | null {
  return readServiceAccount().sa;
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly",
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
  const { sa, problem } = readServiceAccount();
  if (!sa) throw new Error(problem);
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

/**
 * One tab of the Google Sheet with its full formatting (Sheets API, includeGridData),
 * picked by its gid (the number after #gid= in the sheet's URL).
 * Needs the Google Sheets API enabled in the same Google Cloud project.
 */
export async function fetchSheetTab(spreadsheetId: string, gid: number) {
  const { sa, problem } = readServiceAccount();
  if (!sa) throw new Error(problem);
  const auth = { Authorization: `Bearer ${await accessToken(sa)}` };
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
  const explain = async (res: Response) => {
    const body = await res.json().catch(() => ({}));
    const msg: string = body?.error?.message ?? `status ${res.status}`;
    if (/has not been used|is disabled|SERVICE_DISABLED/i.test(msg))
      return "The Google Sheets API isn't enabled. In Google Cloud → APIs & Services → Library, enable “Google Sheets API” for the same project.";
    if (res.status === 403 || res.status === 404) return `The sheet isn't shared with ${sa.client_email}. Share it with that address as a Viewer.`;
    return `Google Sheets returned: ${msg}`;
  };

  const meta = await fetch(`${base}?fields=${encodeURIComponent("properties(spreadsheetTheme),sheets.properties(sheetId,title,gridProperties)")}`, {
    headers: auth,
    signal: AbortSignal.timeout(15000),
  });
  if (!meta.ok) throw new Error(await explain(meta));
  const m = await meta.json();
  const tab = (m.sheets ?? []).find((x: { properties: { sheetId: number } }) => x.properties.sheetId === gid);
  if (!tab) throw new Error(`No tab with gid ${gid} in the sheet. Check the link's #gid= number.`);
  const title: string = tab.properties.title;
  const rows = Math.min(tab.properties.gridProperties?.rowCount ?? 400, 600);
  const cols = Math.min(tab.properties.gridProperties?.columnCount ?? 52, 104);
  const colLetter = (n: number) => {
    let s = "";
    for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
    return s;
  };
  const range = `'${title.replace(/'/g, "''")}'!A1:${colLetter(cols)}${rows}`;
  const fields =
    "sheets(properties(sheetId,title,gridProperties(frozenRowCount,frozenColumnCount,hideGridlines)),merges," +
    "data(columnMetadata(pixelSize,hiddenByUser),rowMetadata(pixelSize,hiddenByUser),rowData(values(formattedValue,effectiveValue," +
    "effectiveFormat(backgroundColor,backgroundColorStyle,horizontalAlignment,verticalAlignment,wrapStrategy,borders," +
    "textFormat(bold,italic,strikethrough,underline,fontSize,fontFamily,foregroundColor,foregroundColorStyle))))))";
  const res = await fetch(`${base}?includeGridData=true&ranges=${encodeURIComponent(range)}&fields=${encodeURIComponent(fields)}`, {
    headers: auth,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(await explain(res));
  const body = await res.json();
  return { sheet: body.sheets?.[0], theme: m.properties?.spreadsheetTheme };
}
