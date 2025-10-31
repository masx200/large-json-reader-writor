import fs from "fs/promises";
import LargeJSONHandler from "./index.js";

export default class ChunkBasedAnalyzer {
  constructor() {
    this.handler = new LargeJSONHandler();
  }

  async analyzeWithChunkReading(filePath) {
    console.log(`\n=== 使用分块读取方法分析文件: ${filePath} ===`);

    try {
      // 获取文件基本信息
      const stats = await fs.stat(filePath);
      const fileSizeInKB = (stats.size / 1024).toFixed(2);

      console.log(`文件大小: ${fileSizeInKB} KB`);

      // 使用分块读取
      let totalChunks = 0;
      let validJSONChunks = 0;
      let totalCharacters = 0;
      let sampleChunks = [];

      for await (
        const { chunk, progress: chunkProgress, position } of this.handler
          .readJSONInChunks(filePath, {
            chunkSize: 1000, // 1KB chunks
            progressCallback: (pos, total) => {
              const currentProgress = Math.round((pos / total) * 100);
              console.log(
                `处理进度: ${currentProgress}% (${
                  (pos / 1024).toFixed(2)
                } KB / ${(total / 1024).toFixed(2)} KB)`,
              );
            },
          })
      ) {
        totalChunks++;
        totalCharacters += chunk.length;

        // 尝试解析JSON
        if (this.handler.validateJSONSnippet(chunk)) {
          validJSONChunks++;

          // 收集前5个有效块作为样本
          if (sampleChunks.length < 5) {
            try {
              const parsed = JSON.parse(chunk);
              sampleChunks.push({
                chunk: chunk.substring(0, 200) +
                  (chunk.length > 200 ? "..." : ""),
                type: this.getDataType(parsed),
                keys: Object.keys(parsed).slice(0, 5),
              });
            } catch (e) {
              // 忽略解析错误
            }
          }
        }

        // 限制分析的前10个块以提高效率
        if (totalChunks >= 10) {
          console.log(`分析完成前10个块，跳过剩余分析...`);
          break;
        }
      }

      // 读取文件的前几KB来分析顶层结构
      const content = await fs.readFile(filePath, "utf8");
      const first10KB = content.substring(0, 10000);

      // 智能查找完整的JSON对象起始和结束位置
      const firstObjStart = first10KB.indexOf("{");
      let topLevelKeys = [];
      let parseError = null;

      try {
        if (firstObjStart !== -1) {
          // 查找第一个完整对象的结束位置
          let braceCount = 0;
          let firstObjEnd = -1;

          for (let i = firstObjStart; i < first10KB.length; i++) {
            const char = first10KB[i];
            if (char === "{") {
              braceCount++;
            } else if (char === "}") {
              braceCount--;
              if (braceCount === 0) {
                firstObjEnd = i + 1;
                break;
              }
            }
          }

          if (firstObjEnd !== -1) {
            const firstObject = first10KB.substring(firstObjStart, firstObjEnd);
            const partialData = JSON.parse(firstObject);
            topLevelKeys = Object.keys(partialData);
          }
        }

        // 如果找不到完整的对象，尝试解析整个文件（但只读取前10KB）
        if (topLevelKeys.length === 0) {
          // 查找可能的完整JSON结构
          let balancedJson = this.findBalancedJSON(first10KB);
          if (balancedJson) {
            const data = JSON.parse(balancedJson);
            topLevelKeys = Object.keys(data);
          }
        }

        return {
          method: "分块读取方法",
          file: filePath,
          basicInfo: {
            fileSize: `${fileSizeInKB} KB`,
            totalChunks: totalChunks,
            validJSONChunks: validJSONChunks,
            totalCharacters: totalCharacters,
          },
          structure: {
            topLevelKeys: topLevelKeys,
            topLevelKeyCount: topLevelKeys.length,
            partialSuccess: topLevelKeys.length > 0,
          },
          sampleChunks: sampleChunks,
          chunkValidation: {
            totalChunks: totalChunks,
            validJSONChunks: validJSONChunks,
            validationRate: totalChunks > 0
              ? ((validJSONChunks / totalChunks) * 100).toFixed(2) + "%"
              : "0%",
          },
          analysisStatus: topLevelKeys.length > 0
            ? "部分结构分析成功"
            : "仅完成基础文件分析",
        };
      } catch (error) {
        parseError = error.message;
        return {
          method: "分块读取方法",
          file: filePath,
          basicInfo: {
            fileSize: `${fileSizeInKB} KB`,
            totalChunks: totalChunks,
            validJSONChunks: validJSONChunks,
            totalCharacters: totalCharacters,
          },
          structure: {
            topLevelKeys: [],
            topLevelKeyCount: 0,
            partialSuccess: false,
          },
          error: `结构分析失败: ${parseError}`,
          sampleChunks: sampleChunks,
          chunkValidation: {
            totalChunks: totalChunks,
            validJSONChunks: validJSONChunks,
            validationRate: totalChunks > 0
              ? ((validJSONChunks / totalChunks) * 100).toFixed(2) + "%"
              : "0%",
          },
          analysisStatus: "仅完成基础文件分析",
        };
      }
    } catch (error) {
      console.error(`分块读取分析失败: ${error.message}`);
      return {
        method: "分块读取方法",
        file: filePath,
        error: error.message,
      };
    }
  }

  getDataType(data) {
    if (Array.isArray(data)) return "array";
    if (data === null) return "null";
    return typeof data;
  }

  /**
   * 查找平衡的JSON结构
   */
  findBalancedJSON(text) {
    let startIdx = -1;
    let endIdx = -1;
    let braceCount = 0;
    let bracketCount = 0;

    // 查找JSON开始位置
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === "{" || char === "[") {
        startIdx = i;
        braceCount = char === "{" ? 1 : 0;
        bracketCount = char === "[" ? 1 : 0;
        break;
      }
    }

    if (startIdx === -1) return null;

    // 查找对应的结束位置
    for (let i = startIdx + 1; i < text.length; i++) {
      const char = text[i];
      if (char === "{") {
        braceCount++;
      } else if (char === "}") {
        braceCount--;
      } else if (char === "[") {
        bracketCount++;
      } else if (char === "]") {
        bracketCount--;
      }

      if (braceCount === 0 && bracketCount === 0) {
        endIdx = i + 1;
        break;
      }
    }

    if (endIdx === -1) return null;

    return text.substring(startIdx, endIdx);
  }

  async analyzeMultipleFiles(filePaths) {
    const results = {};

    for (const filePath of filePaths) {
      console.log(`\n开始分析文件: ${filePath}`);
      results[filePath] = await this.analyzeWithChunkReading(filePath);
    }

    return results;
  }
}

// 如果直接运行此文件，执行分析
if (import.meta.main) {
  async function main() {
    const analyzer = new ChunkBasedAnalyzer();

    const filesToAnalyze = [
      "./test-output.json",
      "./large-example.json",
      "./openapi.json",
    ];

    try {
      const results = await analyzer.analyzeMultipleFiles(filesToAnalyze);

      // 保存结果
      await fs.writeFile(
        "chunk-analysis-results.json",
        JSON.stringify(results, null, 2),
      );
      console.log("\n分块分析结果已保存到: chunk-analysis-results.json");

      // 打印摘要
      console.log("\n=== 分块读取分析摘要 ===");
      Object.entries(results).forEach(([file, result]) => {
        console.log(`\n文件: ${file}`);
        console.log(`大小: ${result.basicInfo?.fileSize || "N/A"}`);
        console.log(
          `顶层键数量: ${result.structure?.topLevelKeyCount || "N/A"}`,
        );
        console.log(
          `分块验证率: ${result.chunkValidation?.validationRate || "N/A"}`,
        );
        if (result.error) {
          console.log(`错误: ${result.error}`);
        }
      });
    } catch (error) {
      console.error("分析失败:", error);
    }
  }

  main();
}
