# 云端更新 / Cloud updates

网页按钮“从官网更新 / Sync from stores”发送 POST `/api/update`。服务器验证固定的三家门店，抓取官方分页、翻译未知商品并写入 R2。公众只能触发从固定来源重新采集，不能选择任意网址或上传任意优惠。并发请求使用 R2 条件写入锁；成功与失败均记录状态。每 10 分钟最多核对一次，重复点击读取最近结果。

POST /api/update collects three fixed official stores in the cloud, translates and persists them in R2. Visitors cannot upload data or choose arbitrary sources. R2 conditional writes coordinate updates; a 10-minute cooldown combines repeated requests. Both success and failure are recorded.

GET `/api/update` 读取检查状态。GET `/api/deals?checkSource=1` 会检查数据是否超过六小时，必要时调用同一受冷却限制的云端采集流程，并返回最新保存的数据；可供独立定时任务调用。普通 `/api/deals` 只读保存结果。本项目当前账号的云端定时任务名额已满，独立云端定时任务未启用。原有本地 Codex 任务保留每周一、四 07:30（Europe/Stockholm）调用上述接口，只有 Codex 可运行时才触发。这不是超市的优惠发布时间保证。

GET /api/update reads status. GET /api/deals?checkSource=1 checks whether stored data is older than six hours and invokes the same cooldown-limited collector if needed. Ordinary /api/deals only reads saved data. A separate cloud schedule is not enabled: this account has reached its scheduled-task limit. The existing local Codex task calls this endpoint Mondays and Thursdays at 07:30 Europe/Stockholm, when Codex can run. This is not a retailer release-time guarantee.

## 本机备用上传 / Local backup

本机脚本仍保留作为备用。`node scripts/sync.mjs`（Node.js 24），Ready 后隐藏 stdin 输入 `{"url":"https://your-site.example"}`。私钥文件 `work/update-key.dpapi` 在 Windows 使用 DPAPI 当前用户加密，服务器只存公钥。备用 `/api/import` 始终验证 ECDSA P-256 / SHA-256 签名，5 分钟过期。不要打印、分享或上传私钥，也不需要将网站服务令牌交给访客。

The optional local backup script signs imports with ECDSA P-256. Private keys remain protected on the maintainer's computer and are excluded from source downloads. Public button updates need no private key and do not use the backup importer.

自行部署需创建自己的 Worker 和 R2 BUCKET；若启用备用上传，先生成自己的密钥并部署新公钥。正常云端按钮更新无须另装本机后台程序。
