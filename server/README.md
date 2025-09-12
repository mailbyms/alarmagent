# AlarmAgent Server

这是一个为 AlarmAgent 前端应用提供动力的后端服务。它基于 Node.js 和 Express 构建，负责处理业务逻辑、数据库交互和执行 Web 自动化工作流。

## 主要功能

-   **RESTful API**: 提供用于管理“智能体”（Agent）的增删改查接口。
-   **工作流执行**: 使用 Playwright 自动化浏览器操作，根据定义好的工作流（Workflow）执行网页登录、点击、输入、截图等任务。
-   **任务持久化**: 将工作流、执行任务历史、任务截图等数据存储在 MySQL 数据库中。
-   **实时反馈**: 通过 Server-Sent Events (SSE) 在执行工作流时向客户端实时推送状态和结果。

## 技术栈

-   **运行时**: Node.js
-   **Web 框架**: Express.js
-   **数据库驱动**: `mysql2` for MySQL
-   **Web 自动化**: Playwright
-   **其他**: `cors`, `uuid`

---

## 环境准备

在运行此服务之前，请确保您的系统已安装以下软件：

1.  **Node.js**: (推荐 v16 或更高版本)
2.  **MySQL**: (推荐 v5.7 或更高版本)
3.  **Git**

## 安装与配置

1.  **克隆仓库**
    ```bash
    git clone <your-repository-url>
    cd AlarmAgent/server
    ```

2.  **安装依赖**
    在 `server` 目录下运行以下命令来安装所有必需的 npm 包：
    ```bash
    npm install
    npx playwright install-deps
    ```
    此命令还会下载 Playwright 所需的浏览器。

3.  **数据库设置**
    a. 登录到您的 MySQL 服务。
    b. 创建一个专门用于此项目的数据库，例如 `alarmagent`。
    c. 导入项目根目录 `doc/alarmagent.sql` 文件来初始化数据库表结构。

4.  **配置数据库连接**
    打开 `server/index.js` 文件，找到 `dbConfig` 对象，并根据您的数据库实例修改连接信息：
    ```javascript
    const dbConfig = {
      host: 'your_database_host',     // 例如: 'localhost'
      user: 'your_database_user',     // 例如: 'root'
      password: 'your_database_password', // 您的密码
      database: 'alarmagent',         // 您创建的数据库名
      port: 3306                      // 您的数据库端口
    };
    ```

## 运行服务

-   **开发模式**:
    此模式使用 `nodemon` 运行服务，文件更改时会自动重启，非常适合开发。
    ```bash
    npm run dev
    ```

-   **生产模式**:
    使用 `node`直接启动服务。
    ```bash
    npm start
    ```

服务启动后，默认监听在 `http://localhost:3001`。

---

## API 端点简介

### 智能体 (Agent) 管理

-   `GET /api/agents`: 获取所有智能体的列表（支持分页）。
-   `GET /api/agents?uuid=<uuid>`: 获取指定 `uuid` 的智能体详情。
-   `DELETE /api/agents/:uuid`: 删除一个智能体。
-   `POST /api/agents/:uuid/name`: 更新智能体的名称。
-   `POST /api/agents/:uuid/workflow`: 创建或更新智能体的工作流定义。

### 工作流 (Workflow) 执行

-   `POST /api/workflow/crawler/test`: 接收一个工作流 JSON 对象，并使用 Playwright 异步执行。通过 SSE 流式返回每一步的执行结果。

### 任务历史与截图

-   `GET /api/crawler/tasks`: 获取所有历史任务的执行记录（支持分页）。
-   `GET /api/crawler/shots?taskId=<taskId>`: 获取指定任务产生的所有截图（以 Base64 格式返回）。
