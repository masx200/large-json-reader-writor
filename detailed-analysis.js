#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import LargeJSONHandler from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 深度分析JSON文件的具体结构
 * @param {string} filePath - 文件路径
 * @param {string} fileName - 文件名
 */
async function analyzeJSONStructure(filePath, fileName) {
  console.log(`\n🔍 深度分析文件: ${fileName}`);
  console.log("═".repeat(80));

  const handler = new LargeJSONHandler();

  try {
    const stats = await fs.promises.stat(filePath);
    console.log(`📊 文件信息:`);
    console.log(`  • 大小: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`  • 修改时间: ${stats.mtime.toLocaleString("zh-CN")}`);

    // 获取文件前几个字符来了解根结构
    const firstChunk = await readFirstChunk(filePath, 500);
    console.log(`\n📖 文件开头:`);
    console.log(firstChunk);

    // 分析根结构
    const rootStructure = await analyzeRootStructure(filePath);
    console.log(`\n🏗️ 根结构分析:`);
    console.log(`  • 根类型: ${rootStructure.type}`);
    if (rootStructure.type === "object" && rootStructure.keys.length > 0) {
      console.log(`  • 顶级键 (${rootStructure.keys.length}):`);
      rootStructure.keys.slice(0, 10).forEach((key) => {
        console.log(`    - ${key}`);
      });
      if (rootStructure.keys.length > 10) {
        console.log(`    ... 还有 ${rootStructure.keys.length - 10} 个键`);
      }
    }

    // 分析数据分布
    const dataDistribution = await analyzeDataDistribution(filePath);
    console.log(`\n📈 数据分布:`);
    console.log(`  • 对象: ${dataDistribution.objects}`);
    console.log(`  • 数组: ${dataDistribution.arrays}`);
    console.log(`  • 字符串: ${dataDistribution.strings}`);
    console.log(`  • 数字: ${dataDistribution.numbers}`);
    console.log(`  • 布尔值: ${dataDistribution.booleans}`);
    console.log(`  • null值: ${dataDistribution.nulls}`);

    // 查找最大的数据结构
    const largestStructures = await findLargestStructures(filePath);
    console.log(`\n🏆 最大的数据结构:`);
    if (largestStructures.length > 0) {
      largestStructures.slice(0, 5).forEach((structure, index) => {
        console.log(
          `  ${index + 1}. ${structure.path}: ${structure.size} 字节`,
        );
      });
    }

    // 分析字符串内容
    const stringAnalysis = await analyzeStringContent(filePath);
    console.log(`\n📝 字符串分析:`);
    console.log(`  • 最短字符串: ${stringAnalysis.minLength} 字符`);
    console.log(`  • 最长字符串: ${stringAnalysis.maxLength} 字符`);
    console.log(`  • 平均长度: ${stringAnalysis.avgLength.toFixed(1)} 字符`);
    if (stringAnalysis.longestStrings.length > 0) {
      console.log(`  • 示例长字符串:`);
      stringAnalysis.longestStrings.slice(0, 3).forEach((str) => {
        console.log(`    - "${str.substring(0, 50)}..." (${str.length} 字符)`);
      });
    }
  } catch (error) {
    console.error(`❌ 分析失败: ${error.message}`);
  }
}

/**
 * 读取文件的第一块
 */
async function readFirstChunk(filePath, size) {
  const handler = new LargeJSONHandler();
  let firstChunk = "";

  for await (
    const { chunk } of handler.readJSONInChunks(filePath, {
      chunkSize: size,
      pretty: true,
    })
  ) {
    firstChunk = chunk;
    break;
  }

  return firstChunk;
}

/**
 * 分析根结构
 */
async function analyzeRootStructure(filePath) {
  const handler = new LargeJSONHandler();
  const firstChunk = await readFirstChunk(filePath, 2000);

  let structure = { type: "unknown", keys: [] };

  try {
    // 尝试解析整个第一块
    const data = JSON.parse(firstChunk);

    if (Array.isArray(data)) {
      structure.type = "array";
      structure.length = data.length;
    } else if (typeof data === "object" && data !== null) {
      structure.type = "object";
      structure.keys = Object.keys(data);
    } else {
      structure.type = typeof data;
      structure.value = data;
    }
  } catch (error) {
    // 如果解析失败，进行部分分析
    structure.type = "unknown";
    structure.error = error.message;
  }

  return structure;
}

/**
 * 分析数据分布
 */
async function analyzeDataDistribution(filePath) {
  const handler = new LargeJSONHandler();
  const distribution = {
    objects: 0,
    arrays: 0,
    strings: 0,
    numbers: 0,
    booleans: 0,
    nulls: 0,
  };

  for await (
    const { chunk } of handler.readJSONInChunks(filePath, {
      chunkSize: 1000,
      pretty: true,
    })
  ) {
    // 简单的字符级统计
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === "\\" && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        if (!inString) {
          distribution.strings++;
        }
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === "{") {
        braceCount++;
        if (braceCount === 1) {
          distribution.objects++;
        }
      } else if (char === "}") {
        braceCount--;
      } else if (char === "[") {
        bracketCount++;
        if (bracketCount === 1) {
          distribution.arrays++;
        }
      } else if (char === "]") {
        bracketCount--;
      } else if (char === "t" || char === "f") {
        // 检测 true/false
        if (chunk.substring(i, i + 4) === "true") {
          distribution.booleans++;
          i += 3;
        } else if (chunk.substring(i, i + 5) === "false") {
          distribution.booleans++;
          i += 4;
        }
      } else if (char === "n") {
        // 检测 null
        if (chunk.substring(i, i + 4) === "null") {
          distribution.nulls++;
          i += 3;
        }
      } else if (char >= "0" && char <= "9") {
        // 简单检测数字
        let numStr = char;
        let j = i + 1;
        while (
          j < chunk.length &&
          (chunk[j] >= "0" && chunk[j] <= "9" || chunk[j] === "." ||
            chunk[j] === "-")
        ) {
          numStr += chunk[j];
          j++;
        }
        if (numStr !== "." && numStr !== "-" && numStr.length > 0) {
          distribution.numbers++;
          i = j - 1;
        }
      }
    }
  }

  return distribution;
}

/**
 * 查找最大的数据结构
 */
async function findLargestStructures(filePath) {
  const handler = new LargeJSONHandler();
  const structures = [];

  let buffer = "";
  let currentPath = "";
  let braceCount = 0;
  let bracketCount = 0;
  let structureStart = 0;

  for await (
    const { chunk } of handler.readJSONInChunks(filePath, {
      chunkSize: 1000,
      pretty: true,
    })
  ) {
    buffer += chunk;

    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i];

      if (char === "{") {
        if (braceCount === 0) {
          structureStart = i;
        }
        braceCount++;
      } else if (char === "}") {
        braceCount--;
        if (braceCount === 0 && structureStart > 0) {
          const size = i - structureStart + 1;
          if (size > 1000) { // 只记录大于1KB的结构
            structures.push({
              path: currentPath,
              size: size,
              type: "object",
            });
          }
          structureStart = 0;
        }
      } else if (char === "[") {
        if (bracketCount === 0) {
          structureStart = i;
        }
        bracketCount++;
      } else if (char === "]") {
        bracketCount--;
        if (bracketCount === 0 && structureStart > 0) {
          const size = i - structureStart + 1;
          if (size > 1000) { // 只记录大于1KB的结构
            structures.push({
              path: currentPath,
              size: size,
              type: "array",
            });
          }
          structureStart = 0;
        }
      }
    }

    if (buffer.length > 20000) {
      buffer = buffer.slice(-10000);
    }
  }

  // 按大小排序
  return structures.sort((a, b) => b.size - a.size);
}

/**
 * 分析字符串内容
 */
async function analyzeStringContent(filePath) {
  const handler = new LargeJSONHandler();
  const analysis = {
    minLength: Infinity,
    maxLength: 0,
    avgLength: 0,
    totalStrings: 0,
    totalLength: 0,
    longestStrings: [],
  };

  for await (
    const { chunk } of handler.readJSONInChunks(filePath, {
      chunkSize: 500,
      pretty: true,
    })
  ) {
    // 使用正则表达式提取字符串
    const stringRegex = /"((?:\\.|[^"\\])*)"/g;
    let match;

    while ((match = stringRegex.exec(chunk)) !== null) {
      const str = match[1];
      const strLength = str.length;

      analysis.totalStrings++;
      analysis.totalLength += strLength;
      analysis.minLength = Math.min(analysis.minLength, strLength);
      analysis.maxLength = Math.max(analysis.maxLength, strLength);

      if (strLength > 50) { // 只记录长字符串
        analysis.longestStrings.push(str);
      }
    }

    // 限制内存使用
    if (analysis.longestStrings.length > 20) {
      analysis.longestStrings = analysis.longestStrings.slice(0, 20);
    }
  }

  if (analysis.totalStrings > 0) {
    analysis.avgLength = analysis.totalLength / analysis.totalStrings;
  }

  if (analysis.minLength === Infinity) {
    analysis.minLength = 0;
  }

  return analysis;
}

/**
 * 主函数
 */
async function main() {
  console.log("🚀 巨型JSON文件详细分析器");
  console.log("═".repeat(80));

  try {
    // 查找JSON文件
    const files = await fs.promises.readdir(__dirname);
    const jsonFiles = files
      .filter((file) =>
        file.endsWith(".json") && !file.includes("test-data") &&
        !file.includes("package")
      )
      .map((file) => ({
        name: file,
        path: path.join(__dirname, file),
      }));

    if (jsonFiles.length === 0) {
      console.log("❌ 没有找到合适的JSON文件");
      return;
    }

    // 分析每个文件
    for (const file of jsonFiles) {
      await analyzeJSONStructure(file.path, file.name);
    }
  } catch (error) {
    console.error("❌ 分析过程失败:", error.message);
  }
}

// 运行主函数
main();
