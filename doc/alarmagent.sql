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

 Date: 11/09/2025 12:05:02
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
  `name` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '智能体名称',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT '简介',
  `status` enum('running','stopped') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'running' COMMENT '运行状态',
  `created_at` datetime NOT NULL COMMENT '创建时间',
  `updated_at` datetime NOT NULL COMMENT '更新时间',
  `screenshot_count` int(11) NOT NULL DEFAULT 0 COMMENT '截图数量',
  `workflow` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT '编排定义，json格式',
  PRIMARY KEY (`idx`) USING BTREE,
  UNIQUE INDEX `uuid`(`uuid`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '智能体管理表' ROW_FORMAT = Dynamic;

SET FOREIGN_KEY_CHECKS = 1;
