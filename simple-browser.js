import LargeJSONHandler from "./index.js";

class SimpleJSONBrowser {
  constructor(options = {}) {
    this.maxChunkSize = options.maxChunkSize || 500;
    this.jsonHandler = new LargeJSONHandler();
  }

  /**
   * 显示 JSON 文件的基本结构
   */
  async showBasicStructure(filePath) {
    console.log(`📋 ${filePath} 的基本结构:\n`);

    let buffer = "";
    let topLevelKeys = new Set();

    for await (
      const { chunk } of this.jsonHandler.readJSONInChunks(filePath, {
        chunkSize: this.maxChunkSize,
      })
    ) {
      buffer += chunk;

      // 提取 JSON 键
      const keyMatches = [...buffer.matchAll(/"([^"]+)"\s*:/g)];
      keyMatches.forEach((match) => topLevelKeys.add(match[1]));

      // 如果缓冲区太大，清理
      if (buffer.length > 10000) {
        buffer = buffer.slice(-5000);
      }

      // 如果已经找到足够多的键，停止
      if (topLevelKeys.size >= 10) {
        break;
      }
    }

    const keys = Array.from(topLevelKeys).slice(0, 10);

    console.log("🔑 主要键:");
    keys.forEach((key, index) => {
      console.log(`  ${index + 1}. ${key}`);
    });

    if (keys.length === 0) {
      console.log("  未找到 JSON 键");
    }

    return keys;
  }

  /**
   * 搜索 JSON 中的特定键
   */
  async searchKey(filePath, searchTerm) {
    console.log(`🔍 搜索 "${searchTerm}":\n`);

    let results = [];
    let buffer = "";
    let lineCount = 0;

    for await (
      const { chunk } of this.jsonHandler.readJSONInChunks(filePath, {
        chunkSize: this.maxChunkSize * 2,
      })
    ) {
      buffer += chunk;
      lineCount++;

      // 搜索匹配的键
      const lines = chunk.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const keyMatch = line.match(/"([^"]+)"\s*:/);
        if (keyMatch) {
          const key = keyMatch[1];
          if (key.toLowerCase().includes(searchTerm.toLowerCase())) {
            // 提取值的一部分
            const valueMatch = line.match(/:\s*"([^"]*)"/);
            let value = "";
            if (valueMatch) {
              value = valueMatch[1].substring(0, 50) +
                (valueMatch[1].length > 50 ? "..." : "");
            }

            results.push({
              key: key,
              value: value,
              line: lineCount - lines.length + i + 1,
            });
          }
        }
      }

      // 限制结果数量
      if (results.length >= 20) {
        break;
      }

      // 清理缓冲区
      if (buffer.length > 20000) {
        buffer = buffer.slice(-10000);
      }
    }

    if (results.length === 0) {
      console.log("❌ 未找到匹配的键");
      return [];
    }

    console.log(`✅ 找到 ${results.length} 个匹配项:`);
    results.forEach((result, index) => {
      console.log(`  ${index + 1}. "${result.key}" (行 ${result.line})`);
      if (result.value) {
        console.log(`     值: "${result.value}"`);
      }
    });

    return results;
  }

  /**
   * 显示 JSON 路径下的内容
   */
  async showPathContent(filePath, targetPath) {
    console.log(`📄 显示路径 "${targetPath}":\n`);

    try {
      let buffer = "";
      let foundContent = "";
      let braceCount = 0;
      let bracketCount = 0;
      let inTargetPath = false;
      let inString = false;
      let escapeNext = false;

      for await (
        const { chunk } of this.jsonHandler.readJSONInChunks(filePath, {
          chunkSize: this.maxChunkSize * 4,
        })
      ) {
        buffer += chunk;

        // 简单的路径匹配逻辑
        if (!inTargetPath) {
          // 检查是否包含目标路径
          const pathMatch = buffer.includes(`"${targetPath}"`);
          if (pathMatch) {
            inTargetPath = true;
            const pathIndex = buffer.indexOf(`"${targetPath}"`);
            const contentStart = buffer.indexOf(":", pathIndex) + 1;
            foundContent = buffer.substring(contentStart);
          }
        } else {
          foundContent += chunk;

          // 检查是否到达内容结尾
          for (let i = 0; i < foundContent.length; i++) {
            const char = foundContent[i];

            if (escapeNext) {
              escapeNext = false;
              continue;
            }

            if (char === "\\" && inString) {
              escapeNext = true;
              continue;
            }

            if (char === '"') {
              inString = !inString;
              continue;
            }

            if (!inString) {
              if (char === "{" || char === "[") {
                braceCount++;
              } else if (char === "}" || char === "]") {
                braceCount--;
                if (braceCount < 0) {
                  // 内容结束
                  foundContent = foundContent.substring(0, i);
                  break;
                }
              }
            }
          }

          // 如果内容过大，截断
          if (foundContent.length > 1000) {
            foundContent = foundContent.substring(0, 1000) + "...";
            break;
          }
        }

        // 如果已经找到内容且足够大，停止
        if (foundContent.length > 500 && inTargetPath) {
          break;
        }
      }

      if (foundContent) {
        // 尝试格式化输出
        try {
          // 移除开头可能的逗号
          foundContent = foundContent.trim().replace(/^,/, "");
          const parsed = JSON.parse(foundContent);
          console.log(
            JSON.stringify(parsed, null, 2).substring(0, 800) + "...",
          );
        } catch (e) {
          console.log("原始内容:");
          console.log(foundContent.substring(0, 500) + "...");
        }
      } else {
        console.log("❌ 未找到该路径");
      }
    } catch (error) {
      console.error("显示内容失败:", error);
    }
  }

  /**
   * 显示 JSON 统计信息
   */
  async showStats(filePath) {
    console.log(`📊 ${filePath} 统计信息:\n`);

    let stats = {
      totalSize: 0,
      keyCount: 0,
      arrayCount: 0,
      objectCount: 0,
      stringCount: 0,
      numberCount: 0,
      booleanCount: 0,
      nullCount: 0,
    };

    let buffer = "";

    for await (
      const { chunk } of this.jsonHandler.readJSONInChunks(filePath, {
        chunkSize: this.maxChunkSize * 3,
      })
    ) {
      buffer += chunk;
      stats.totalSize += chunk.length;

      // 统计基本结构
      stats.keyCount += (chunk.match(/"([^"]+)"\s*:/g) || []).length;
      stats.arrayCount += (chunk.match(/\[/g) || []).length;
      stats.objectCount += (chunk.match(/\{/g) || []).length;

      // 估算其他类型
      stats.stringCount += (chunk.match(/"([^"]+)"/g) || []).length;
      stats.numberCount += (chunk.match(/\b\d+\.?\d*\b/g) || []).length;
      stats.booleanCount += (chunk.match(/\b(true|false)\b/g) || []).length;
      stats.nullCount += (chunk.match(/\bnull\b/g) || []).length;

      // 限制处理量
      if (stats.totalSize > 100000) {
        break;
      }
    }

    console.log("📈 基本信息:");
    console.log(`  📁 文件大小: ${(stats.totalSize / 1024).toFixed(2)} KB`);
    console.log(`  🔑 键数量: ${stats.keyCount}`);
    console.log(`  📁 对象数量: ${stats.objectCount}`);
    console.log(`  📋 数组数量: ${stats.arrayCount}`);
    console.log(`  📝 字符串数量: ${stats.stringCount}`);
    console.log(`  🔢 数字数量: ${stats.numberCount}`);
    console.log(`  ✅ 布尔值数量: ${stats.booleanCount}`);
    console.log(`  ⚪ null 值数量: ${stats.nullCount}`);

    return stats;
  }
}

// 示例使用
async function runSimpleBrowserExample() {
  const browser = new SimpleJSONBrowser();

  console.log("=== 简单 JSON 浏览器示例 ===\n");

  // 1. 显示基本结构
  console.log("1️⃣ 显示基本结构");
  await browser.showBasicStructure("./openapi.json");

  console.log("\n" + "=".repeat(50) + "\n");

  // 2. 搜索功能
  console.log("2️⃣ 搜索功能");
  await browser.searchKey("./openapi.json", "title");

  console.log("\n" + "=".repeat(50) + "\n");

  // 3. 显示路径内容
  console.log("3️⃣ 显示路径内容");
  await browser.showPathContent("./openapi.json", "info");

  console.log("\n" + "=".repeat(50) + "\n");

  // 4. 统计信息
  console.log("4️⃣ 统计信息");
  await browser.showStats("./openapi.json");

  console.log("\n✅ 示例完成！");
}

// 运行示例
runSimpleBrowserExample().catch(console.error);

export default SimpleJSONBrowser;
