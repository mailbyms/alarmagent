const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'AlarmAgent API 文档',
    version: '1.0.0',
    description: 'AlarmAgent 项目的 API 接口文档',
  },
  servers: [
    {
      url: 'http://localhost:3001', // 根据您的实际服务地址修改
      description: '开发服务器',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./routes/*.js'], // 指定包含 JSDoc 注释的路由文件路径
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;