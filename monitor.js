/* 访客行为监测（前端埋点）· 幻灯游园
 * 纯静态站：本脚本只负责「发现可疑行为并上报」，接收/回看在 Cloudflare Worker（见 monitoring/）。
 * 部署 Worker 后，把下面 ENDPOINT 填成你的 /collect 地址即可；留空则不上报，站点照常运行。
 * 只记录行为类型与粗粒度环境（页面/来源/UA/屏幕/语言/时间），不收集个人身份信息。
 * 局限：前端监测能被关掉 JS 或改代码绕过——它看得见普通访客和不太高明的捣乱，挡不住铁了心的攻击者。
 */
(function () {
  "use strict";

  // ↓↓↓ 部署 Worker 后填这里，例：https://xiaoluoppt-monitor.你的子域.workers.dev/collect
  var ENDPOINT = "";

  // 会话标识（仅本次浏览器会话，关掉即失效，非身份信息）
  var sid;
  try {
    sid = sessionStorage.getItem("hp_sid");
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("hp_sid", sid);
    }
  } catch (e) {
    sid = "nostore";
  }

  var seen = {}; // 同类事件节流，避免刷爆
  function send(type, detail, throttleMs) {
    if (throttleMs) {
      var now = Date.now();
      if (seen[type] && now - seen[type] < throttleMs) return;
      seen[type] = now;
    }
    var payload = {
      type: type,
      detail: detail || null,
      path: location.pathname + location.search + location.hash,
      ref: document.referrer || null,
      ua: navigator.userAgent,
      lang: navigator.language,
      screen: screen.width + "x" + screen.height,
      view: window.innerWidth + "x" + window.innerHeight,
      sid: sid,
      ts: new Date().toISOString(),
    };
    if (!ENDPOINT) {
      if (type !== "pageview") console.debug("[monitor]", type, detail || "");
      return;
    }
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, body);
      else fetch(ENDPOINT, { method: "POST", body: body, keepalive: true, mode: "no-cors" });
    } catch (e) {}
  }

  // 1) 进入页面
  send("pageview");

  // 2) URL 里夹带 XSS 特征
  try {
    var url = decodeURIComponent(location.search + location.hash);
    if (/<\s*script|<\s*img|<\s*svg|on\w+\s*=|javascript:/i.test(url)) {
      send("suspicious-url", { url: url.slice(0, 300) });
    }
  } catch (e) {}

  // 3) localStorage 收藏值被塞了不正常内容（正常应是 a-z0-9- 的短 id 数组）
  try {
    var raw = localStorage.getItem("flagship-ppt-candidates");
    if (raw) {
      var bad = false;
      try {
        var arr = JSON.parse(raw);
        if (!Array.isArray(arr)) bad = true;
        else bad = arr.some(function (x) { return typeof x !== "string" || !/^[a-z0-9-]{1,60}$/.test(x); });
      } catch (e) {
        bad = true;
      }
      if (bad) send("localstorage-tamper", { raw: String(raw).slice(0, 200) });
    }
  } catch (e) {}

  // 4) 控制台执行脚本（重写全局 eval；本站自身不用 eval，触发即来自控制台/注入）
  try {
    var _eval = window.eval;
    window.eval = function (s) {
      send("console-eval", { snippet: String(s).slice(0, 200) }, 2000);
      return _eval(s);
    };
  } catch (e) {}

  // 5) 打开开发者工具（按窗口内外尺寸差判断，阈值粗略，仅作信号）
  var devtoolsOpen = false;
  function checkDevtools() {
    var open = window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 160;
    if (open && !devtoolsOpen) {
      devtoolsOpen = true;
      send("devtools-open", null, 60000);
    } else if (!open) {
      devtoolsOpen = false;
    }
  }
  window.addEventListener("resize", checkDevtools, { passive: true });
  setInterval(checkDevtools, 3000);
  checkDevtools();

  // 6) 异常高频点击（疑似脚本/爬虫）
  var clicks = [];
  window.addEventListener(
    "click",
    function () {
      var now = Date.now();
      clicks.push(now);
      clicks = clicks.filter(function (t) { return now - t < 1000; });
      if (clicks.length > 12) send("rapid-clicks", { count: clicks.length }, 5000);
    },
    { passive: true }
  );

  // 7) 脚本错误 / 未处理的 Promise（可能是注入尝试或异常）
  window.addEventListener("error", function (e) {
    send("js-error", { msg: String((e && e.message) || "").slice(0, 200), src: String((e && e.filename) || "").slice(0, 200) }, 5000);
  });
  window.addEventListener("unhandledrejection", function (e) {
    send("promise-reject", { reason: String((e && e.reason) || "").slice(0, 200) }, 5000);
  });

  // 8) 控制台自我保护提示（防社工诱导粘贴恶意代码）
  try {
    console.log("%c⚠ 停一下", "color:#c73e68;font-size:14px;font-weight:700");
    console.log("%c别在这里粘贴或运行任何陌生代码——可能被用来盗用你的账号或数据。", "color:#3e2f35;font-size:12px");
  } catch (e) {}
})();
