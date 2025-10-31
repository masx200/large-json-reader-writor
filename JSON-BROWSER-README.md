# JSON 结构浏览器

这是一个用于浏览和分析大型 JSON 文件的 Node.js 工具集。它采用分块处理技术，可以高效地处理超出内存限制的大型 JSON 文件。

## 文件结构

- `index.js` - 核心 JSON 处理模块（下载、分块读写）
- `json-browser.js` - JSON 结构分析浏览器
- `json-parser.js` - 流式 JSON 解析器
- `interactive-browser.js` - 交互式命令行浏览器
- `simple-browser.js` - 简化版 JSON 浏览器
- `browser-example.js` - 浏览器使用示例
- `example.js` - 基础功能示例

## 核心功能

### 1. 分块处理大型 JSON 文件
- 流式下载和读取
- 避免内存溢出
- 每次处理内容控制在 500 字符以内

### 2. 结构分析
- 识别 JSON 根类型
- 提取顶级键
- 统计对象、数组数量
- 分析数据类型分布

### 3. 路径导航
- 支持对象属性访问（`info.title`）
- 支持数组索引访问（`paths[0]`）
- 支持复杂路径（`paths["/__radar/api/requests"].get`）

### 4. 搜索功能
- 键名搜索
- 值搜索
- 模糊匹配

## 使用方法

### 基础使用

```bash
# 1. 下载大型 JSON 文件
node example.js

# 2. 查看基本结构
node simple-browser.js

# 3. 运行完整示例
node browser-example.js
```

### 交互式浏览器

```bash
# 启动交互式浏览器
node interactive-browser.js openapi.json

# 可用命令:
#   help     - 显示帮助
#   ls       - 列出当前路径内容
#   cd <path>- 导航到指定路径
#   cat <path>- 显示路径内容
#   pwd      - 显示当前路径
#   search <term> - 搜索键或值
#   tree     - 显示树状结构
#   info     - 显示详细信息
#   quit     - 退出
```

### 路径示例

```javascript
// 导航示例
cd info                    // 导航到 info 对象
cd info.title              // 导航到 info.title 属性
cd paths["/__radar/api/requests"] // 导航到特定API路径
cd paths[0]               // 导航到 paths 数组的第一个元素
cd ..                     // 返回上级目录
cd /                      // 返回根目录
```

## 编程接口

### 基础 API

```javascript
import LargeJSONHandler from './index.js';
import SimpleJSONBrowser from './simple-browser.js';

// 创建处理器
const handler = new LargeJSONHandler();
const browser = new SimpleJSONBrowser();

// 下载文件
await handler.downloadJSON('http://example.com/large.json', './data.json');

// 显示基本结构
await browser.showBasicStructure('./data.json');

// 搜索键
const results = await browser.searchKey('./data.json', 'title');

// 显示路径内容
await browser.showPathContent('./data.json', 'info');

// 获取统计信息
const stats = await browser.showStats('./data.json');
```

### 高级 API

```javascript
import StreamingJSONParser from './json-parser.js';
import JSONStructureBrowser from './json-browser.js';

const parser = new StreamingJSONParser();
const browser = new JSONStructureBrowser();

// 获取基本结构
const structure = await parser.getBasicStructure('./data.json');

// 导航到特定路径
const pathInfo = await parser.getPathInfo('./data.json', 'info.title');

// 深度分析
const deepStructure = await browser.analyzeStructure('./data.json');
```

## 配置选项

### 处理器配置

```javascript
const browser = new SimpleJSONBrowser({
    maxChunkSize: 500  // 每次处理的最大字符数
});
```

### 浏览器配置

```javascript
const browser = new JSONStructureBrowser({
    maxDisplayLength: 300,    // 最大显示长度
    maxArrayItems: 5,          // 数组显示的最大项目数
    maxObjectKeys: 5           // 对象显示的最大键数
});
```

## 性能优化

### 内存管理
- 自动清理缓冲区
- 流式处理避免内存堆积
- 智能分块大小调整

### 搜索优化
- 提前终止搜索
- 结果数量限制
- 模糊匹配优化

## 测试结果

使用 `openapi.json`（221.29 KB）的测试结果：

```
📊 JSON 文件统计:
  📁 文件大小: 221.29 KB
  🔑 键数量: 7,490
  📁 对象数量: 4,226
  📋 数组数量: 260
  📝 字符串数量: 10,581
  🔢 数字数量: 588
  ✅ 布尔值数量: 437
  ⚪ null 值数量: 59
```

## 限制和注意事项

1. **单次处理限制**: 每次处理内容限制在 500 字符以内，避免超出上下文限制

2. **复杂路径**: 支持大多数 JSONPath 语法，但不支持过滤器表达式

3. **大文件处理**: 对于特别大的文件（>1GB），建议使用数据库或专门的 JSON 处理工具

4. **性能权衡**: 功能完整性与性能之间的权衡，某些复杂操作可能需要较长时间

## 扩展功能

### 自定义处理器

```javascript
class CustomJSONBrowser extends SimpleJSONBrowser {
    async customOperation(filePath) {
        // 实现自定义操作
    }
}
```

### 插件系统

```javascript
// 可以扩展搜索、分析、格式化等功能
const plugins = {
    search: customSearchPlugin,
    analyze: customAnalyzePlugin,
    format: customFormatPlugin
};
```

## 故障排除

### 常见问题

1. **内存不足**: 调整 `maxChunkSize` 参数
2. **解析失败**: 检查 JSON 文件格式是否正确
3. **路径不存在**: 使用 `ls` 命令查看可用路径

### 调试模式

```bash
# 启用详细日志
DEBUG=json-browser node simple-browser.js
```

## 贡献

欢迎提交问题和功能请求。请确保：

1. 提供复现步骤
2. 包含错误信息
3. 测试大型 JSON 文件

## 许可证

MIT License