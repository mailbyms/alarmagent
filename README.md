# 智能体中心管理后台

本项目为“智能体中心”管理后台，前端基于 Vue 3 + Vite，后端基于 Node.js + Express + MySQL，支持智能体的编排。

## 目录结构

```
AlarmAgent/
├── doc/                # 设计稿等文档
├── server/             # 后端 Node.js + Express + MySQL API
│   ├── index.js        # 主服务入口
│   └── package.json    # 后端依赖与脚本
├── src/                # 前端 Vue 3 + Vite 源码
│   └── components/     # 主要页面组件
├── package.json        # 前端依赖与脚本
└── README.md           # 项目说明
```

## 快速开始

### 1. 安装依赖

```bash
# 安装前端依赖
npm install
# 安装后端依赖
cd server && npm install
```

### 2. 配置数据库

- 创建名为 `alarmagent` 的 MySQL 数据库。
- 导入数据库表初始化脚本doc/alarmagent.sql，并插入测试数据：
- 修改 `server/index.js` 里的数据库连接配置为你的实际 MySQL 地址、端口、用户名和密码。

### 3. 配置环境变量
服务端使用了modelscope提供的视觉大模型对截图进行告警信息分析提取， 需要在环境变量定义 token
```
echo "MODELSCOPE_API_KEY=ms-xxxx" > server/.env
```

### 4. 启动开发环境

推荐使用 concurrently 一键启动前后端：

```bash
npm install concurrently --save-dev
npm run dev2
```

或分别启动：

```bash
# 启动后端
npm run dev --prefix server
# 启动前端
npm run dev
```

### 5. 访问

- 前端开发环境：http://localhost:5173
- 后端 API：http://localhost:3001/api/agents

## 代理配置

前端已配置 Vite 代理，将 /api 请求自动转发到后端 3001 端口。

## 主要功能
- 智能体列表展示（从数据库实时获取）
- 新建、刷新、详情等操作
- 支持后端 API 扩展

## 设计稿
- 见 doc/dash.png

## 其他
如需自定义功能或遇到问题，请联系开发者。
