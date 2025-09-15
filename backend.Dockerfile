# 后端 Dockerfile
FROM node:20
WORKDIR /app

# 复制后端项目的 package.json 和 package-lock.json
COPY server/package*.json ./

# 安装后端依赖，包括 playwright
RUN npm install --registry=https://registry.npmmirror.com \
  && npx playwright install chromium

# 更新apt源并安装 Playwright 所需的系统依赖
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
  && sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
  && apt-get update \
  && npx playwright install-deps

# 复制后端项目的源代码
COPY server/ ./

EXPOSE 3001

# 容器启动命令
CMD ["node", "index.js"]