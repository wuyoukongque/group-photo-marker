import { NextResponse } from "next/server";

const APP_ID = process.env.FEISHU_APP_ID || "";
const APP_SECRET = process.env.FEISHU_APP_SECRET || "";
const APP_TOKEN = "Xh3pbIguTao7wVsuLZvcRM3PnKg";
const TABLE_ID = "tblE4y89nwwncB5r";

interface FeishuRecord {
  name: string;
  company: string;
  role: string;
}

let cachedToken = "";
let tokenExpiry = 0;
let cachedRecords: FeishuRecord[] = [];
let recordsCacheTime = 0;
const RECORDS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getTenantToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
    }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Feishu auth failed: ${data.msg}`);
  cachedToken = data.tenant_access_token;
  tokenExpiry = Date.now() + (data.expire - 60) * 1000;
  return cachedToken;
}

async function getAllRecords(): Promise<FeishuRecord[]> {
  if (cachedRecords.length > 0 && Date.now() - recordsCacheTime < RECORDS_CACHE_TTL) {
    return cachedRecords;
  }

  const token = await getTenantToken();
  const records: FeishuRecord[] = [];
  let pageToken = "";
  let hasMore = true;

  while (hasMore) {
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records?page_size=100${pageToken ? `&page_token=${pageToken}` : ""}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.code !== 0) throw new Error(`Feishu API error: ${data.msg}`);

    for (const item of data.data.items || []) {
      const fields = item.fields;
      const name = extractText(fields["客户姓名"]);
      const company = extractText(fields["公司"]);
      const role = extractSelect(fields["职级"]);
      if (name) {
        records.push({ name, company, role });
      }
    }

    hasMore = data.data.has_more;
    pageToken = data.data.page_token || "";
  }

  cachedRecords = records;
  recordsCacheTime = Date.now();
  return records;
}

function extractText(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (Array.isArray(val) && val.length > 0) {
    return val.map((v) => v.text || v.name || "").join("");
  }
  return "";
}

function extractSelect(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) {
    return val.map((v) => (typeof v === "string" ? v : v.text || v.name || "")).join("/");
  }
  return "";
}

// POST: match names to company info
export async function POST(request: Request) {
  try {
    const { names } = await request.json();
    if (!Array.isArray(names)) {
      return NextResponse.json({ error: "names must be an array" }, { status: 400 });
    }

    const records = await getAllRecords();
    const results: Record<string, { company: string; role: string } | null> = {};

    for (const name of names) {
      const match = records.find((r) => r.name === name);
      results[name] = match ? { company: match.company, role: match.role } : null;
    }

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/feishu/match error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
