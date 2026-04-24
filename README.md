# jinshi-market-brief-worker

一个基于 **Cloudflare Workers + D1 + KV** 的金十网页快照简报项目。  
它会抓取 `jin10.com` 与 `xnews.jin10.com` 的公开网页内容，用 **Cloudflare Workers AI** 生成一份中文市场简报，并推送到飞书。

## 功能

- 额外生成超详细版 Markdown 报告并上传到腾讯云 COS
- 每 **3 小时** 定时生成一次简报
- 数据源来自：
  - `https://www.jin10.com/` 首页快讯区
  - `https://xnews.jin10.com/` 头条列表区
- 使用 Workers AI 生成中文市场摘要（默认最低成本模型）
- 飞书机器人推送
- 24 小时心跳
- 连续失败告警
- 手动触发接口
- D1 保存摘要记录，KV 保存运行状态

## 当前实现边界

这是一个**网页快照版**实现，不是官方 API 版：

- 抓取的是网页公开可见内容
- 更适合做“当前市场脉络简报”
- 不保证严格覆盖完整的过去 3 小时全部快讯
- 如果页面结构变化，解析逻辑需要同步调整

## 本地开发

```bash
npm install
npm run check
npx wrangler dev
```

健康检查：

```bash
curl http://127.0.0.1:8787/health
```

## 环境变量

### Wrangler vars

已在 `wrangler.jsonc` 中给出默认值：

- `DIGEST_INTERVAL_HOURS`
- `HEARTBEAT_INTERVAL_HOURS`
- `REQUEST_TIMEOUT_MS`
- `FETCH_WINDOW_HOURS`
- `MAX_ITEMS_PER_DIGEST`
- `LLM_MODEL`
- `JINSHI_HOME_URL`
- `JINSHI_XNEWS_URL`
- `FAILURE_ALERT_THRESHOLD`
- `FAILURE_ALERT_COOLDOWN_MINUTES`

### Secrets

需要通过 `.dev.vars` 或 Cloudflare secrets 提供：

- `FEISHU_WEBHOOK`
- `FEISHU_SECRET`
- `MANUAL_TRIGGER_TOKEN`
- `TENCENT_COS_SECRET_ID`
- `TENCENT_COS_SECRET_KEY`
- `TENCENT_COS_BUCKET`
- `TENCENT_COS_REGION`
- `TENCENT_COS_BASE_URL`（可选，自定义访问域名）

## 手动触发

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_MANUAL_TRIGGER_TOKEN" \
  https://<your-worker>/admin/trigger
```

## Cloudflare 资源绑定

需要创建并绑定：

- 一个 D1 数据库：`jinshi-market-brief`
- 一个 KV namespace：运行状态

然后把对应的 `database_id` / `kv id` 回填到 `wrangler.jsonc`。

## 风险说明

- 本项目基于网页快照抓取，不是金十官方授权数据接入
- AI 能力由 Cloudflare Workers AI 提供，默认模型为低成本文本模型
- 页面结构、文案、链接结构变化会影响抓取结果
- 站点条款与数据使用限制需要你自行评估并承担合规责任
