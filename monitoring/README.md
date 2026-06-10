# 访客监测部署（Cloudflare Worker）

纯静态站没有后端，所以「接收访客上报 + 你回看」这部分放在 Cloudflare Worker 上。
全程免费额度足够（每天 10 万次读、1000 次写，小站根本用不完）。

## 它能看到什么

前端 `monitor.js` 会在以下情况上报一条记录，你在回看页能看到，高风险的会**粉色高亮**：

| 类型 | 含义 |
|---|---|
| `pageview` | 普通访问（谁来了、从哪来、什么设备） |
| `suspicious-url` | 网址里夹带 `<script>`、`onerror=`、`javascript:` 等 XSS 特征 |
| `console-eval` | 有人在浏览器控制台执行了脚本 |
| `localstorage-tamper` | 本地收藏数据被手动塞了不正常的值 |
| `devtools-open` | 打开了开发者工具（F12） |
| `rapid-clicks` | 1 秒内异常高频点击（疑似脚本/爬虫） |
| `js-error` / `promise-reject` | 页面报错（可能是注入尝试） |

> 诚实提醒：前端监测能被「关掉 JS / 改代码」绕过。它能抓住普通访客和不太高明的捣乱，
> 但拦不住铁了心的攻击者。好在这个站是纯展示、没有后端和登录，真正的高危面本来就很小。

## 部署步骤（约 5 分钟）

1. 装好 Node，然后装 Cloudflare 的命令行工具：
   ```
   npm i -g wrangler
   ```
2. 登录（会弹浏览器授权你的 Cloudflare 账号）：
   ```
   wrangler login
   ```
3. 在本目录（`monitoring/`）创建 KV 存储：
   ```
   wrangler kv namespace create LOGS
   ```
   把命令返回的 `id = "..."` 粘进 `wrangler.toml` 里的 `id =`。
4. 设置回看口令（自己想一个，输入时不显示）：
   ```
   wrangler secret put VIEW_TOKEN
   ```
5. 部署：
   ```
   wrangler deploy
   ```
   部署成功会给你一个网址，形如
   `https://xiaoluoppt-monitor.你的子域.workers.dev`
6. 把上报地址填回站点：打开站点根目录的 `monitor.js`，把第 14 行的
   ```js
   var ENDPOINT = "";
   ```
   改成
   ```js
   var ENDPOINT = "https://xiaoluoppt-monitor.你的子域.workers.dev/collect";
   ```
   然后重新 push（GitHub Pages 会自动更新）。
   > 站点 `index.html` 的 CSP 里已经放行了 `*.workers.dev`，不用再改。
   > 如果你给 Worker 绑了**自定义域名**，记得把那个域名也加进 CSP 的 `connect-src`。

## 怎么回看

浏览器打开（把口令换成你第 4 步设的）：
```
https://xiaoluoppt-monitor.你的子域.workers.dev/view?token=你的口令
```
就是一张按时间倒序的表格，最新在最上面，高风险粉色高亮。刷新即看最新。

## 隐私与合规

只记录行为类型 + 粗粒度环境（页面、来源、UA、屏幕、语言、IP/国家）。不收集姓名、账号等身份信息，
数据 30 天自动清除。如果站点面向公众，建议在页脚加一句「本站会记录匿名访问与安全日志」。
