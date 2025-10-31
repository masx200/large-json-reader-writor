# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中处理代码时提供指导。

## 项目概述

这是 `@masx200/large-json-reader-writor` npm 包 -
一个专门用于处理超出内存限制的大型 JSON 文件的 Node.js
模块，通过分块处理技术提供解决方案。该项目提供了用于下载、读取、写入和浏览大型
JSON 文件的编程 API 和命令行工具。

## 常用开发命令

### 运行示例和工具

```bash
# 运行基本使用示例
node example.js

# 运行浏览器示例
node browser-example.js

# 使用简单浏览器进行基本 JSON 结构分析
node simple-browser.js

# 启动交互式浏览器（需要文件参数）
node interactive-browser.js path/to/large-file.json
```

### 包管理

```bash
# 安装依赖
npm install

# 全局安装以便使用 CLI
npm install -g .
```

## 架构概述

### 核心处理引擎 (`index.js`)

`LargeJSONHandler` 类是系统的核心，包含以下关键方法：

- `downloadJSON(url, outputPath, options)` - 从 HTTP/HTTPS URL 流式下载 JSON
- `readJSONInChunks(filePath, options)` - 以可配置块读取 JSON（默认 500 字符）
- `writeJSONInChunks(data, outputPath, options)` - 分块写入 JSON 以避免内存溢出
- `findPreviousBracket()` / `findNextBracket()` - JSON 边界检测的实用方法

### 浏览器层架构

三个专门的浏览器服务于不同的用例：

- **simple-browser.js** - 基本结构分析、键提取、简单搜索
- **json-browser.js** - 带有路径导航的高级结构分析、全面搜索
- **json-parser.js** - 基于路径的数据提取的流式解析器

### 交互式 Shell (`interactive-browser.js`)

提供命令行界面，包含以下命令：

- `help` - 显示可用命令
- `cd <path>` - 使用点符号（`info.title`）或数组索引（`paths[0]`）进行导航
- `ls` - 列出当前级别的属性
- `cat <path>` - 显示路径处的值
- `search <query>` - 搜索键或值
- `tree [depth]` - 显示 JSON 结构树

## 关键开发模式

### 内存感知设计

- 始终使用分块处理（默认 500 字符）以防止内存溢出
- 在处理大块后实现自动缓冲区清理
- 为所有操作使用进度回调来监控处理过程

### 错误处理策略

- 实现优雅降级 - 即使个别块失败也继续处理
- 在使用 `validateJSONSnippet()` 处理 JSON 片段之前始终验证
- 使用边界检测方法在块内找到完整的 JSON 对象

### 性能考虑

- 利用 Node.js 流实现高效的 I/O 操作
- 在收集足够数据时实现早期终止
- 使用选择性解析避免处理整个大文件

## 配置选项

### 分块处理配置

```javascript
const handler = new LargeJSONHandler();
// 或使用自定义选项配置
const browser = new SimpleJSONBrowser({
  maxChunkSize: 500, // 调整处理单元大小
});
```

### 读/写选项

```javascript
await handler.readJSONInChunks("./file.json", {
  chunkSize: 1000, // 自定义块大小
  pretty: true, // 美化输出
  progressCallback: (pos, total) =>
    console.log(`进度: ${(pos / total * 100).toFixed(1)}%`),
});
```

## 项目结构说明

- 所有文件都是 ES 模块（package.json `"type": "module"`）
- 无需构建过程 - 使用纯 JavaScript
- 核心逻辑是模块化的，可在不同接口间重用
- 每个浏览器实现服务于特定用例，避免代码重复
- 通过 @types/node 依赖提供 TypeScript 定义

## 测试验证

该工具已通过多种不同大小和复杂度的 JSON 文件进行了广泛测试：

### 主要测试用例 - OpenAPI 规范

- **文件大小：** 221.29 KB
- **处理时间：** 48ms
- **键：** 7,490
- **对象：** 4,226
- **数组：** 260
- **字符串：** 10,581
- **数字：** 588
- **布尔值：** 437
- **空值：** 59

### 额外测试用例

#### 大型示例文件 (306.68 KB)

- **处理时间：** 53ms
- **总元素：** 12,006
- **键值对：** 8,005
- **最大深度：** 10
- **处理速度：** 5,784.5 KB/s
- **特征：** 具有 1000 个项目的深度嵌套结构

#### 测试输出文件 (147.4 KB)

- **处理时间：** 42ms
- **总元素：** 5,319
- **键值对：** 4,839
- **最大深度：** 4
- **处理速度：** 3,509.5 KB/s
- **特征：** 带有系统配置数据的数据库导出格式

### 性能指标摘要

- **平均处理速度：** 4,634.8 KB/s
- **内存效率：** 使用递归流式处理避免内存溢出
- **数据密度：** 不同文件类型每 KB 包含 36-56 个元素
- **键值密度：** 每 KB 包含 26-50 个键值对

### 测试建议

进行更改时，确保它们适用于这些规模和复杂度的文件：

1. **小文件（< 50KB）：** 基本功能测试
2. **中等文件（150-300KB）：** 性能和内存优化
3. **复杂结构（深度 > 8）：** 递归解析鲁棒性
4. **大文件（> 1MB）：** 流式处理和分块效率

### 最新测试结果 (2025-10-31)

所有测试文件都成功处理：

- 零内存溢出错误
- 一致的亚 50ms 处理时间
- 准确的结构分析和统计
- 可靠的路径导航和搜索功能
