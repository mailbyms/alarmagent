/*
 Navicat Premium Data Transfer

 Source Server         : 10.13.3.8
 Source Server Type    : MySQL
 Source Server Version : 50730
 Source Host           : 10.13.3.8:7306
 Source Schema         : alarmagent

 Target Server Type    : MySQL
 Target Server Version : 50730
 File Encoding         : 65001

 Date: 15/09/2025 12:37:35
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for agents
-- ----------------------------
DROP TABLE IF EXISTS `agents`;
CREATE TABLE `agents`  (
  `idx` int(11) NOT NULL AUTO_INCREMENT COMMENT '内部自增主键',
  `uuid` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '对外唯一标识(UUID)',
  `icon` varchar(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '智能体名称',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT '简介',
  `status` enum('running','stopped') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'running' COMMENT '运行状态',
  `created_at` datetime NOT NULL COMMENT '创建时间',
  `updated_at` datetime NOT NULL COMMENT '更新时间',
  `screenshot_count` int(11) NOT NULL DEFAULT 0 COMMENT '截图数量',
  `workflow` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT '编排定义，json格式',
  PRIMARY KEY (`idx`) USING BTREE,
  UNIQUE INDEX `uuid`(`uuid`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 7 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '智能体管理表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for crawler_shot
-- ----------------------------
DROP TABLE IF EXISTS `crawler_shot`;
CREATE TABLE `crawler_shot`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `task_id` bigint(20) UNSIGNED NOT NULL COMMENT '关联的爬虫任务ID',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '保存时间',
  `image_base64` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'Base64编码的PNG图片',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_task_id`(`task_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 12 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '爬虫截图表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for crawler_task
-- ----------------------------
DROP TABLE IF EXISTS `crawler_task`;
CREATE TABLE `crawler_task`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `agent_uuid` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '智能体UUID',
  `workflow_json` json NOT NULL COMMENT '工作流定义（JSON）',
  `start_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '启动时间',
  `end_time` datetime NULL DEFAULT NULL COMMENT '完成时间',
  `status` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending' COMMENT '任务状态（pending/running/success/failed）',
  `result` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT '任务结果或异常信息',
  `analysis_result` json NULL COMMENT '截图分析结果',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_agent_uuid`(`agent_uuid`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 9 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '爬虫任务记录表' ROW_FORMAT = Dynamic;

SET FOREIGN_KEY_CHECKS = 1;
