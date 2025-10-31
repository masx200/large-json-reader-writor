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

      for await (const { chunk, progress: chunkProgress, position } of this.handler.readJSONInChunks(filePath, {
        chunkSize: 1000, // 1KB chunks
        progressCallback: (pos, total) => {
          const currentProgress = Math.round((pos / total) * 100);
          console.log(`处理进度: ${currentProgress}% (${(pos / 1024).toFixed(2)} KB / ${(total / 1024).toFixed(2)} KB)`);
        }
      })) {
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
                chunk: chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''),
                type: this.getDataType(parsed),
                keys: Object.keys(parsed).slice(0, 5)
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
      const content = await fs.readFile(filePath, 'utf8');
      const first5KB = content.substring(0, 5000);

      try {
        const partialData = JSON.parse(first5KB);
        const topLevelKeys = Object.keys(partialData);

        return {
          method: "分块读取方法",
          file: filePath,
          basicInfo: {
            fileSize: `${fileSizeInKB} KB`,
            totalChunks: totalChunks,
            validJSONChunks: validJSONChunks,
            totalCharacters: totalCharacters
          },
          structure: {
            topLevelKeys: topLevelKeys,
            topLevelKeyCount: topLevelKeys.length
          },
          sampleChunks: sampleChunks,
          chunkValidation: {
            totalChunks: totalChunks,
            validJSONChunks: validJSONChunks,
            validationRate: totalChunks > 0 ? ((validJSONChunks / totalChunks) * 100).toFixed(2) + '%' : '0%'
          }
        };
      } catch (parseError) {
        return {
          method: "分块读取方法",
          file: filePath,
          basicInfo: {
            fileSize: `${fileSizeInKB} KB`,
            totalChunks: totalChunks,
            validJSONChunks: validJSONChunks,
            totalCharacters: totalCharacters
          },
          error: "无法解析顶层JSON结构",
          sampleChunks: sampleChunks,
          chunkValidation: {
            totalChunks: totalChunks,
            validJSONChunks: validJSONChunks,
            validationRate: totalChunks > 0 ? ((validJSONChunks / totalChunks) * 100).toFixed(2) + '%' : '0%'
          }
        };
      }

    } catch (error) {
      console.error(`分块读取分析失败: ${error.message}`);
      return {
        method: "分块读取方法",
        file: filePath,
        error: error.message
      };
    }
  }

  getDataType(data) {
    if (Array.isArray(data)) return 'array';
    if (data === null) return 'null';
    return typeof data;
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
      './test-output.json',
      './large-example.json',
      './openapi.json'
    ];

    try {
      const results = await analyzer.analyzeMultipleFiles(filesToAnalyze);

      // 保存结果
      await fs.writeFile('chunk-analysis-results.json', JSON.stringify(results, null, 2));
      console.log('\n分块分析结果已保存到: chunk-analysis-results.json');

      // 打印摘要
      console.log('\n=== 分块读取分析摘要 ===');
      Object.entries(results).forEach(([file, result]) => {
        console.log(`\n文件: ${file}`);
        console.log(`大小: ${result.basicInfo?.fileSize || 'N/A'}`);
        console.log(`顶层键数量: ${result.structure?.topLevelKeyCount || 'N/A'}`);
        console.log(`分块验证率: ${result.chunkValidation?.validationRate || 'N/A'}`);
        if (result.error) {
          console.log(`错误: ${result.error}`);
        }
      });

    } catch (error) {
      console.error('分析失败:', error);
    }
  }

  main();
}