# 顺路（Shunlu）

> 随手拍，让每条路都顺。  
> **AI 青年行 · 2026 高校好事计划** 参赛作品

一款面向公众的城市无障碍环境体检与众包协作 H5 / App 产品：市民在街头随手拍下盲道被占、坡道损坏、台阶无扶手等问题，AI 自动识别问题类型与严重程度、为人脸和车牌打码、标上地图，并一键生成符合《中华人民共和国无障碍环境建设法》的 12345 / 12315 反映文本。

## 核心功能

- **随手拍 + AI 识别与审核**：调用通义千问视觉大模型（阿里云百炼），一次请求完成内容审核（过滤无关/不当图片）、问题分类、严重程度分级、问题描述、责任部门与渠道推荐（12345 / 12315）。
- **隐私自动打码 + 手动补涂**：AI 定位画面中的人脸与车牌，服务器端使用 `sharp` 自动马赛克处理，前端支持手指手动补涂马赛克。
- **地图与众包协作**：接入腾讯位置服务地图，支持按问题类型筛选；其他市民可点击「我也遇到」、提交「回头看」复查照片，推动状态从「待反映 → 已反映 → 已整改」流转。
- **AI 填单助手与本地举报资料卡**：AI 自动生成规范的 12345 / 12315 反映文本，支持一键复制与一键拨号/跳转；姓名与电话仅存于用户手机 `localStorage`，不上传服务器。
- **趣味激励与分享海报**：积分体系、体检官等级、7 枚成就勋章、个人/城市排行榜，以及一键生成可保存的体检官分享海报（含二维码）。
- **城市无障碍体检报告**：按城市/区县汇总问题分布与整改率，AI 生成体检结论与整改建议，支持导出 PDF。
- **内容管理后台**（`/admin`）：支持密码登录、修改问题状态、下架/恢复违规内容。

## 技术栈

- **前端（`web/`）**：React 19 + TypeScript + Vite + Tailwind CSS v4 + 腾讯地图 JavaScript API GL
- **后端（`server/`）**：Node.js 22 + Hono + SQLite（`better-sqlite3`）+ `sharp` + OpenAI SDK（兼容阿里云百炼通义千问）
- **移动端打包**：可通过 Capacitor 封装为 Android APK

## 本地运行

需要 Node.js 22+。

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（可选；不配置也能以 AI 模拟模式 + 列表模式运行）
cp .env.example .env
# 编辑 .env 填入 DASHSCOPE_API_KEY、TMAP_KEY、ADMIN_PASSWORD

# 3. 启动前后端开发服务
npm run dev
```

启动后访问：
- 前端 H5：`http://localhost:5173`
- 后端 API：`http://localhost:8787`
- 管理后台：`http://localhost:5173/admin`

运行接口冒烟测试（需先启动服务）：

```bash
npm run smoke -w server
```

## 申请 API Key 指引

1. **阿里云百炼（`DASHSCOPE_API_KEY`）**
   - 登录 [阿里云百炼控制台](https://bailian.console.aliyun.com/)，开通模型服务并在「API-KEY 管理」中创建 Key。
   - 默认使用 `qwen-vl-max`（视觉识别）和 `qwen-plus`（文本生成），可在 `.env` 中替换。
2. **腾讯位置服务（`TMAP_KEY`）**
   - 登录 [腾讯位置服务控制台](https://lbs.qq.com/)，在「应用管理 → 我的应用」中创建应用并添加 Key。
   - 勾选开通 **JavaScript API GL**（前端地图渲染）与 **WebService API**（后端逆地址解析）。

## 生产构建与部署

```bash
# 构建前端静态资源到 web/dist
npm run build

# 启动后端（自动托管 web/dist 与 /uploads）
npm start
```

建议使用香港/海外服务器 + 域名 + Caddy 反向代理到 `127.0.0.1:8787` 自动签发 HTTPS 证书（浏览器调用摄像头和定位接口需要 HTTPS）。

## 许可证

MIT
