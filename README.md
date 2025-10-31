# 大型 JSON 文件读写工具

这是一个 Node.js 模块，专门用于处理大型 JSON 文件的下载、读取和写入操作。

## 功能特性

- **流式下载**：支持从 URL 下载大型 JSON 文件，避免内存溢出
- **分块读取**：将大型 JSON 文件分成小块读取，避免超出上下文限制
- **分块写入**：支持将大型数据分块写入文件，减少内存压力
- **智能解析**：自动识别 JSON 结构，提供格式化输出
- **进度跟踪**：实时显示下载和读写进度

## 安装

```bash
npm install
```

## 使用方法

### 1. 下载 JSON 文件

```javascript
import LargeJSONHandler from './index.js';

const jsonHandler = new LargeJSONHandler();

await jsonHandler.downloadJSON(
    'http://localhost:8000/openapi.json',
    './openapi.json'
);
```

### 2. 分块读取 JSON 文件

```javascript
// 基础读取
for await (const { chunk, position, progress } of jsonHandler.readJSONInChunks('./openapi.json')) {
    console.log(`进度: ${progress}%`);
    console.log('内容片段:', chunk);
}

// 带进度回调的读取
for await (const { chunk, position, progress } of jsonHandler.readJSONInChunks('./openapi.json', {
    chunkSize: 500,  // 每次读取的字符数
    pretty: true,    // 美化输出
    progressCallback: (pos, total) => {
        console.log(`读取进度: ${Math.round((pos / total) * 100)}%`);
    }
})) {
    // 处理每个块
    console.log(chunk);
}
```

### 3. 分块写入 JSON 文件

```javascript
const largeData = {
    // 你的大型数据对象
    items: Array.from({ length: 10000 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        value: Math.random() * 1000
    }))
};

await jsonHandler.writeJSONInChunks('./large-data.json', largeData, {
    chunkSize: 500,
    pretty: true
});
```

## 配置选项

### 读取选项
- `chunkSize`: 每次读取的字符数（默认：500）
- `pretty`: 是否美化输出（默认：false）
- `progressCallback`: 进度回调函数

### 写入选项
- `chunkSize`: 每次写入的字符数（默认：500）
- `append`: 是否追加到现有文件（默认：false）
- `pretty`: 是否美化输出（默认：false）

## 运行示例

```bash
node example.js
```

## 注意事项

1. **内存管理**：工具自动处理大型文件，避免内存溢出
2. **JSON 验证**：自动检测和验证 JSON 结构的完整性
3. **错误处理**：包含完善的错误处理机制
4. **性能优化**：通过分块处理提高大文件处理效率