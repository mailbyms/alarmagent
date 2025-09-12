# 前端 Dockerfile
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --registry=https://registry.npmmirror.com
COPY . .
RUN npm run build

FROM nginx:1.18.0
COPY --from=build /app/dist /usr/share/nginx/html
# 拷贝自定义nginx配置，支持/api代理
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
