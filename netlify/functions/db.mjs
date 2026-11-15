import { getStore } from "@netlify/blobs";

const COLS = new Set(["questions", "exams", "visitors", "results"]);
const PRIVATE = new Set(["visitors", "results"]);
const PIN = (process.env.ADMIN_PIN || "mahdi a").trim().toLowerCase();
const ID_OK = /^[\w-]{1,64}$/;

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export default async (req) => {
  const store = getStore("sociology-exam");
  const admin = (req.headers.get("x-pin") || "").trim().toLowerCase() === PIN;
  try {
    if (req.method === "GET") {
      const col = new URL(req.url).searchParams.get("col");
      if (!COLS.has(col)) return json({ error: "bad_collection" }, 400);
      if (PRIVATE.has(col) && !admin) return json({ error: "forbidden" }, 403);
      const { blobs } = await store.list({ prefix: col + "/" });
      const docs = (
        await Promise.all(
          blobs.map(async (b) => {
            const data = await store.get(b.key, { type: "json" });
            return data ? { id: b.key.slice(col.length + 1), data } : null;
          })
        )
      ).filter(Boolean);
      return json({ docs });
    }

    const body = await req.json().catch(() => null);
    if (!body || !COLS.has(body.col) || !ID_OK.test(body.id || "")) return json({ error: "bad_request" }, 400);
    const key = body.col + "/" + body.id;

    if (req.method === "POST") {
      if (!PRIVATE.has(body.col) && !admin) return json({ error: "forbidden" }, 403);
      const str = JSON.stringify(body.data ?? {});
      if (str.length > 300000) return json({ error: "too_large" }, 413);
      await store.set(key, str);
      return json({ ok: true });
    }
    if (req.method === "DELETE") {
      if (!admin) return json({ error: "forbidden" }, 403);
      await store.delete(key);
      return json({ ok: true });
    }
    return json({ error: "method" }, 405);
  } catch (e) {
    return json({ error: "server" }, 500);
  }
};

export const config = { path: "/api/db" };
