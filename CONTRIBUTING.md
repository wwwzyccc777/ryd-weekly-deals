# 参与贡献 / Contributing

欢迎通过 Issue 报告商品翻译、图片、优惠条件或数据异常，并提供商品瑞典语原名、门店和官方链接。提交修改前执行 `npm run build`、`npm test`、`npm run validate`。

- 翻译：维护 `data/names.*` 与 `data/descriptions.*`，保留品牌、规格、会员与押金条件。
- 界面：修改 `src/ui.html` 和 `src/ui.js`，同步维护中文与英语。
- 解析及推荐：修改 `src/core.mjs`；新增规则应给出单价依据。
- 门店：`STORES` 是当前三家门店白名单。新增门店还需要调整导入校验、测试和界面，不是仅添加任意网址。
- 构建文件不提交；`worker/`、`dist/` 和 `work/` 在本地生成。

Report issues with the Swedish product name, store and official URL. Keep both UI languages and clear promotion conditions. Build and run tests before a pull request. New stores require verified identities and corresponding validation / test changes. Do not commit generated builds or credentials.
