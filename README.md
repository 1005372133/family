# 家庭备忘助理

本地 Node.js 应用，数据存储在 SQLite 数据库文件中。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express |
| 数据库 | SQLite（通过 sql.js） |
| 前端 | 原生 HTML/CSS/JS（ES Modules） |
| OCR | Tesseract.js（浏览器端识别） |
| PDF | PDF.js（浏览器端解析） |

## 项目结构

```
family-memo/
├── server.js              # Express 服务器 + REST API
├── package.json           # 依赖声明
├── family_memo.db         # SQLite 数据库文件（运行后自动生成）
└── web/                   # 前端静态文件
    ├── index.html
    ├── config/
    │   └── site.json      # 站点配置（标题、分类、文案、功能开关）
    ├── css/               # 样式文件
    └── js/
        ├── app.js         # 入口，初始化流程
        ├── config.js      # 加载 site.json
        ├── access.js      # 访问验证（公网访问码）
        ├── db.js          # API 客户端（fetch 封装）
        ├── render.js      # DOM 渲染
        ├── events.js      # 事件绑定
        ├── ocr.js         # OCR + PDF + 图片处理
        └── utils.js       # 工具函数
```

## 启动方式

```bash
npm install    # 首次运行，安装依赖
npm start      # 启动服务
```

服务启动后访问 http://localhost:3456

停止服务：在终端按 `Ctrl+C`

## 数据存储

- 所有数据（备忘、分类、附件）存储在 `family_memo.db` 文件中
- 每次增删改操作后自动写入磁盘
- 备份数据库：直接复制 `family_memo.db` 文件即可
- 查看数据库内容：使用 [DB Browser for SQLite](https://sqlitebrowser.org/) 打开 `.db` 文件

## REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/categories` | 获取分类列表 |
| POST | `/api/categories` | 新建分类 |
| PUT | `/api/categories/:id` | 更新分类 |
| DELETE | `/api/categories/:id` | 删除分类 |
| GET | `/api/memos` | 获取备忘列表 |
| POST | `/api/memos` | 新建备忘 |
| PUT | `/api/memos/:id` | 更新备忘 |
| PATCH | `/api/memos/:id/toggle` | 切换完成状态 |
| DELETE | `/api/memos/:id` | 删除备忘 |
| GET | `/api/memos/:memoId/attachments` | 获取备忘附件 |
| GET | `/api/attachments/:attId/data` | 获取附件原始数据 |
| POST | `/api/attachments` | 上传附件 |
| DELETE | `/api/attachments/:attId` | 删除附件 |
| DELETE | `/api/memos/:memoId/attachments/:attId` | 删除备忘的某个附件 |

## 配置说明

修改 `web/config/site.json` 可调整：

- **site** — 站点标题和副标题
- **access** — 公网访问码（`code` 字段）。内网访问不受限制；公网访问需输入该码，验证通过后浏览器记住凭证
- **defaults** — 默认时间范围、默认日期
- **categories** — 预置分类（id、名称、图标、颜色）
- **ui** — 界面文案、可选图标/颜色、时间筛选选项、统计项
- **features** — 功能开关（OCR、附件、金额、优先级、图片自动旋转、灯箱预览）

## 访问控制

- **内网访问**（localhost、192.168.x.x、10.x.x.x 等私有地址）：直接打开，无需验证
- **公网访问**：显示验证页，输入 `access.code` 配置的访问码后才能查看
- 验证通过后凭证保存在浏览器本地，下次访问自动放行
- 数据 API 同样受保护：公网未验证请求返回 401，无法绕过页面直接抓取数据
- 访问码仅存于服务端配置文件，下发前端的配置中已剥离该字段

## 功能

- 备忘的增删改查，支持标题、内容、金额、优先级
- 数据来源记录：自动识别添加设备（iPhone/华为/小米/Mac/Windows 等 + 浏览器），展示在卡片上
- 分类管理（自定义图标和颜色），新增备忘时一键管理
- 标题模糊搜索（200ms 防抖）
- 时间范围筛选（今天/本周/本月/近三月/全部/自定义），按备忘日期过滤
- 分类标签筛选
- 分页展示（默认 20 条/页，可选 10/20/50/100）
- 内容默认展示 3 行，超出自动折叠，一键展开/收起
- 图片/PDF 附件上传
- 长图自动分块 OCR（按 1500px 高度切分，逐块识别）
- OCR 流式输出（识别过程中实时显示进度和已识别文字）
- 图片 EXIF 方向自动纠正
- 灯箱预览：支持缩放（0.25x~5x，滚轮/按钮）、拖拽平移
- 附件 OCR 结果查看、文件下载
- 统计面板（备忘条数、金额合计、待办重要、已完成）
- 移动端适配：华为/苹果手机完整适配，支持刘海屏安全区域、触摸操作
