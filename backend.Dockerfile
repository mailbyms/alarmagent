# 后端 Dockerfile
FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install --registry=https://registry.npmmirror.com \
  && npx playwright install chromium 
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
  && sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
  && apt update \
  && npx playwright install-deps
COPY . .
EXPOSE 3001
CMD ["node", "server/index.js"]
