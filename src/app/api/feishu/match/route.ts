import { NextResponse } from "next/server";

const APP_ID = process.env.FEISHU_APP_ID || "";
const APP_SECRET = process.env.FEISHU_APP_SECRET || "";
const APP_TOKEN = "Xh3pbIguTao7wVsuLZvcRM3PnKg";
const TABLE_ID = "tblE4y89nwwncB5r";

interface FeishuRecord {
  name: string;
  wechatName: string;
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
      const wechatName = extractText(fields["微信昵称"]);
      const company = extractText(fields["公司"]);
      const role = extractSelect(fields["职级"]);
      if (name || wechatName) {
        records.push({ name, wechatName, company, role });
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

function fuzzyMatch(query: string, records: FeishuRecord[]): FeishuRecord | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  // 1. Exact match on name
  const exact = records.find((r) => r.name.toLowerCase() === q);
  if (exact) return exact;

  // 2. Exact match on wechat name
  const wechatExact = records.find((r) => r.wechatName.toLowerCase() === q);
  if (wechatExact) return wechatExact;

  // 3. Name contains query or query contains name (for partial Chinese names)
  const nameContains = records.find(
    (r) => r.name && (r.name.includes(q) || q.includes(r.name))
  );
  if (nameContains) return nameContains;

  // 4. Wechat name contains query or query contains wechat name
  const wechatContains = records.find(
    (r) => r.wechatName && (r.wechatName.toLowerCase().includes(q) || q.includes(r.wechatName.toLowerCase()))
  );
  if (wechatContains) return wechatContains;

  return null;
}

// POST: match names to company info
export async function POST(request: Request) {
  try {
    const { names } = await request.json();
    if (!Array.isArray(names)) {
      return NextResponse.json({ error: "names must be an array" }, { status: 400 });
    }

    const records = await getAllRecords();
    const results: Record<string, { company: string; role: string; matchedName: string } | null> = {};

    for (const name of names) {
      const match = fuzzyMatch(name, records);
      results[name] = match
        ? { company: match.company, role: match.role, matchedName: match.name }
        : null;
    }

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/feishu/match error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
