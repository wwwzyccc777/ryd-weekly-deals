# 自行部署 / Deploy your own instance

## Cloudflare Workers + R2

1. 创建自己的 Cloudflare 账号并确认 Workers、R2 的可用额度。此仓库不含作者的账号凭据或站点编号。
2. 在项目目录运行 `npx wrangler login`，按官方流程登录。
3. 运行 `npx wrangler r2 bucket create ryd-weekly-deals`。若选其他桶名，同时修改 `wrangler.jsonc` 的 `bucket_name`。绑定名必须是 `BUCKET`。
4. 可选：运行 `python scripts/package-source.py`，打包网页的源码下载。正常运行网站无需 Python。
5. 运行 `npm run build`、`npm test`、`npm run validate`。
6. 运行 `npx wrangler deploy`。Wrangler 会按配置重新构建 Worker。
7. 打开返回的网址，点击“从官网更新”。检查三个门店的同步时间和数据；首次同步前会显示有日期的快照。

Node.js 24+ is required. Log in with Wrangler, create your own R2 bucket, keep the binding name `BUCKET`, build and test, then deploy. Python only prepares the optional source-download archive. Verify the initial sync in your browser. Platform pricing and free allowances are account-dependent.

官方说明：[Wrangler 配置](https://developers.cloudflare.com/workers/wrangler/configuration/)、[R2 绑定](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)。

## Sites

使用自己的 Sites 项目，填写 `.openai/hosting.json` 的 `project_id`，保留 `r2: "BUCKET"`。运行构建并按 Sites 的源码同步、保存版本和发布流程部署。该文件在本开源项目中只含通用存储声明。

Use your own Sites project ID and preserve the R2 binding. Build, synchronize source, save a version and publish through Sites. The author's site identity is excluded.

## 定时检查 / Scheduled checks

有任务服务时，可以定时 GET `https://你的站点/api/deals?checkSource=1&run=时间戳`：保存数据超过六小时才触发重新采集，仍受 10 分钟冷却限制。普通 `/api/deals` 仅读保存的数据。检查三家门店的 `status`、`error`、`fetchedAt`，不要只看 HTTP 200。

A scheduler can GET `/api/deals?checkSource=1&run=<timestamp>`. Data older than six hours triggers collection, subject to the same cooldown. Inspect each store's status, error and fetchedAt; HTTP 200 alone does not prove successful collection. This repository's CI does not update the live website.

## 备用签名上传 / Optional signed backup

公开云端按钮不需要私钥。只有使用备用本机上传时，才运行 `npm run setup-key` 生成自己的密钥，再构建并部署新公钥。Windows 私钥使用当前用户 DPAPI 保存于忽略的 `work/`；其他系统需保护自己的私钥文件。不要提交或分享私钥。详细说明见 [UPDATES.md](../UPDATES.md)。

Public cloud sync needs no private key. Optional backup imports require your own generated key and redeployment of its public key. Private material stays outside Git. The shipped public verification key grants no signing ability.
