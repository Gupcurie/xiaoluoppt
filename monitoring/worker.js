/* Cloudflare Worker · 幻灯游园访客监测「接收 + 回看」
 * 路由：
 *   POST /collect            接收前端上报，写入 KV（自动补上 Cloudflare 提供的 IP/国家）
 *   GET  /view?token=口令     口令校验后，用网页表格回看最近事件
 * 需要绑定：KV namespace 取名 LOGS；Secret 取名 VIEW_TOKEN（你的回看口令）
 * 部署见同目录 README.md。
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    // ---- 接收上报 ----
    if (url.pathname === "/collect" && request.method === "POST") {
      let evt = {};
      try { evt = JSON.parse(await request.text()); } catch (e) {}
      const rec = {
        ...evt,
        ip: request.headers.get("CF-Connecting-IP") || null,
        country: (request.cf && request.cf.country) || null,
        city: (request.cf && request.cf.city) || null,
        at: Date.now(),
      };
      // key 用「倒序时间戳」让最新的排在 list 最前
      const key = `evt:${1e15 - Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      try {
        await env.LOGS.put(key, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 30 }); // 保留 30 天
      } catch (e) {}
      return new Response("ok", { headers: cors });
    }

    // ---- 口令回看 ----
    if (url.pathname === "/view" && request.method === "GET") {
      if (!env.VIEW_TOKEN || url.searchParams.get("token") !== env.VIEW_TOKEN) {
        return new Response("forbidden", { status: 401 });
      }
      const list = await env.LOGS.list({ prefix: "evt:", limit: 300 });
      const rows = [];
      for (const k of list.keys) {
        const v = await env.LOGS.get(k.name);
        if (v) { try { rows.push(JSON.parse(v)); } catch (e) {} }
      }
      return new Response(renderHtml(rows), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    return new Response("not found", { status: 404 });
  },
};

const RISKY = new Set(["suspicious-url", "console-eval", "localstorage-tamper", "devtools-open", "rapid-clicks", "js-error", "promise-reject"]);

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function renderHtml(rows) {
  const trs = rows
    .map((r) => {
      const risky = RISKY.has(r.type);
      const when = new Date(r.at || r.ts || Date.now()).toLocaleString("zh-CN");
      return `<tr class="${risky ? "risk" : ""}">
      <td>${esc(when)}</td>
      <td><b>${esc(r.type)}</b></td>
      <td>${esc(r.detail ? JSON.stringify(r.detail) : "")}</td>
      <td>${esc(r.country)} ${esc(r.ip)}</td>
      <td title="${esc(r.ua)}">${esc((r.ua || "").slice(0, 48))}</td>
      <td>${esc(r.ref || "")}</td>
      <td>${esc(r.sid)}</td>
    </tr>`;
    })
    .join("");
  const riskCount = rows.filter((r) => RISKY.has(r.type)).length;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>访客监测 · 幻灯游园</title>
<style>
body{font:14px/1.6 system-ui,"Microsoft YaHei",sans-serif;margin:0;background:#fff9f2;color:#3e2f35}
header{position:sticky;top:0;padding:14px 20px;background:#fff;border-bottom:1px solid #f3e6dc;z-index:2}
h1{margin:0;font-size:18px}.sub{color:#8c7a80;font-size:12px;margin-top:4px}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{padding:7px 10px;text-align:left;border-bottom:1px solid #f3e6dc;vertical-align:top;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
th{position:sticky;top:64px;background:#fdeef3;color:#a82f55}
tr.risk{background:#fff0f3}tr.risk b{color:#c73e68}
td b{font-weight:700}
</style></head><body>
<header><h1>访客监测 · 最近 ${rows.length} 条<span style="color:#c73e68"> · 高风险 ${riskCount}</span></h1>
<div class="sub">高风险行为粉色高亮。数据保留 30 天自动清除。刷新本页看最新。</div></header>
<table><thead><tr><th>时间</th><th>类型</th><th>详情</th><th>IP/国家</th><th>UA</th><th>来源</th><th>会话</th></tr></thead>
<tbody>${trs || '<tr><td colspan="7">暂无数据</td></tr>'}</tbody></table>
</body></html>`;
}
