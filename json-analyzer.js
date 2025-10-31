import streamChain from 'stream-chain';
import streamJson from 'stream-json';
import { StreamValues } from 'stream-json/streamers/StreamValues.js';
import { StreamArray } from 'stream-json/streamers/StreamArray.js';
import { StreamObject } from 'stream-json/streamers/StreamObject.js';
import fs from 'fs';
import path from 'path';

export default class JSONAnalyzer {
  constructor() {
    this.stats = {
      totalSize: 0,
      rootKeys: 0,
      objects: 0,
      arrays: 0,
      strings: 0,
      numbers: 0,
      booleans: 0,
      nulls: 0,
      topLevelKeys: [],
      keyFrequency: new Map(),
      valueFrequency: new Map(),
      arraySizes: new Map(),
      objectDepths: new Map(),
      paths: new Map(),
      maxDepth: 0,
      processingTime: 0
    };
  }

  /**
   * 使用流式处理分析JSON文件
   * @param {string} filePath - JSON文件路径
   * @returns {Promise<object>} - 分析报告
   */
  async analyzeJSON(filePath) {
    console.log(`🔍 开始分析JSON文件: ${filePath}`);
    const startTime = Date.now();

    // 获取文件大小
    const stats = fs.statSync(filePath);
    this.stats.totalSize = stats.size;
    console.log(`📁 文件大小: ${(this.stats.totalSize / 1024).toFixed(2)} KB`);

    return new Promise((resolve, reject) => {
      try {
        const pipeline = streamChain.chain([
          fs.createReadStream(filePath),
          streamJson.parser(),
          new StreamValues()
        ]);

        let currentPath = [];
        let currentDepth = 0;

        pipeline.on('data', (data) => {
          if (data.key !== undefined) {
            currentPath = currentPath.slice(0, data.depth - 1);
            currentPath.push(data.key);
            currentDepth = data.depth;

            this.updateStats(data.value, currentPath);
            this.trackPath(currentPath, data.value);
          }
        });

        pipeline.on('end', () => {
          this.stats.processingTime = Date.now() - startTime;
          const report = this.generateReport(filePath);
          console.log(`✅ 分析完成，耗时: ${this.stats.processingTime}ms`);
          resolve(report);
        });

        pipeline.on('error', (error) => {
          console.error('❌ 流式处理错误:', error);
          reject(error);
        });

      } catch (error) {
        console.error('❌ 创建分析管道失败:', error);
        reject(error);
      }
    });
  }

  /**
   * 更新统计信息
   */
  updateStats(value, path) {
    const type = this.getValueType(value);
    const pathStr = path.join('.');

    // 更新类型统计
    switch (type) {
      case 'object':
        this.stats.objects++;
        break;
      case 'array':
        this.stats.arrays++;
        if (Array.isArray(value)) {
          this.stats.arraySizes.set(pathStr, value.length);
        }
        break;
      case 'string':
        this.stats.strings++;
        break;
      case 'number':
        this.stats.numbers++;
        break;
      case 'boolean':
        this.stats.booleans++;
        break;
      case 'null':
        this.stats.nulls++;
        break;
    }

    // 更新最大深度
    this.stats.maxDepth = Math.max(this.stats.maxDepth, path.length);

    // 记录路径
    if (path.length > 0) {
      const lastKey = path[path.length - 1];
      this.stats.keyFrequency.set(lastKey, (this.stats.keyFrequency.get(lastKey) || 0) + 1);
    }
  }

  /**
   * 跟踪路径
   */
  trackPath(path, value) {
    const pathStr = path.join('.');
    if (!this.stats.paths.has(pathStr)) {
      this.stats.paths.set(pathStr, {
        type: this.getValueType(value),
        count: 0,
        examples: []
      });
    }

    const pathInfo = this.stats.paths.get(pathStr);
    pathInfo.count++;

    if (pathInfo.examples.length < 3) {
      pathInfo.examples.push(value);
    }
  }

  /**
   * 获取值类型
   */
  getValueType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'unknown';
  }

  /**
   * 递归分析数据结构
   */
  analyzeStructure(obj, path = '') {
    if (obj === null) {
      this.stats.nulls++;
      return;
    }

    if (typeof obj === 'string') {
      this.stats.strings++;
      return;
    }

    if (typeof obj === 'number') {
      this.stats.numbers++;
      return;
    }

    if (typeof obj === 'boolean') {
      this.stats.booleans++;
      return;
    }

    if (Array.isArray(obj)) {
      this.stats.arrays++;
      obj.forEach((item, index) => {
        this.analyzeStructure(item, `${path}[${index}]`);
      });
      return;
    }

    if (typeof obj === 'object') {
      this.stats.objects++;
      Object.keys(obj).forEach(key => {
        this.analyzeStructure(obj[key], `${path}.${key}`);
      });
    }
  }

  /**
   * 分析数据库表结构
   */
  analyzeTables(data) {
    Object.entries(data).forEach(([tableName, tableData]) => {
      if (typeof tableData === 'object' && tableData !== null) {
        const tableStats = this.analyzeTable(tableName, tableData);
        this.stats.tableAnalysis[tableName] = tableStats;
        this.stats.largestTables.push({
          name: tableName,
          recordCount: tableStats.recordCount,
          size: tableStats.estimatedSize
        });
      }
    });

    // 按记录数量排序
    this.stats.largestTables.sort((a, b) => b.recordCount - a.recordCount);
  }

  /**
   * 分析单个表
   */
  analyzeTable(tableName, tableData) {
    const stats = {
      recordCount: 0,
      hasRecords: false,
      isEmpty: true,
      fields: new Set(),
      estimatedSize: 0,
      structure: {}
    };

    // 查找实际的记录数组
    Object.entries(tableData).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        stats.recordCount = value.length;
        stats.hasRecords = stats.recordCount > 0;
        stats.isEmpty = stats.recordCount === 0;
        stats.fields = new Set();

        if (stats.hasRecords && value.length > 0) {
          // 分析第一条记录的结构
          const firstRecord = value[0];
          if (typeof firstRecord === 'object' && firstRecord !== null) {
            Object.keys(firstRecord).forEach(field => {
              stats.fields.add(field);
              stats.structure[field] = typeof firstRecord[field];
            });
          }
        }

        // 估算大小（简化计算）
        stats.estimatedSize = value.length * 200; // 假设每条记录平均200字节
      }
    });

    return stats;
  }

  /**
   * 计算复杂度指标
   */
  calculateComplexity(data) {
    this.stats.complexityMetrics = {
      depth: this.calculateDepth(data),
      breadth: this.stats.rootKeys,
      density: (this.stats.objects + this.stats.arrays) / (this.stats.totalSize / 1024),
      nestingLevel: this.calculateMaxNesting(data)
    };
  }

  /**
   * 计算JSON深度
   */
  calculateDepth(obj, currentDepth = 0) {
    if (obj === null || typeof obj !== 'object') {
      return currentDepth;
    }

    let maxDepth = currentDepth;
    Object.values(obj).forEach(value => {
      if (typeof value === 'object' && value !== null) {
        const depth = this.calculateDepth(value, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    });

    return maxDepth;
  }

  /**
   * 计算最大嵌套层数
   */
  calculateMaxNesting(obj, currentLevel = 0, path = '') {
    if (obj === null || typeof obj !== 'object') {
      return currentLevel;
    }

    let maxLevel = currentLevel;
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        const level = this.calculateMaxNesting(value, currentLevel + 1, `${path}.${key}`);
        maxLevel = Math.max(maxLevel, level);
      }
    });

    return maxLevel;
  }

  /**
   * 生成Markdown分析报告
   */
  generateReport(filePath) {
    const fileName = path.basename(filePath);
    const reportDate = new Date().toISOString();
    const totalElements = this.stats.objects + this.stats.arrays + this.stats.strings +
                         this.stats.numbers + this.stats.booleans + this.stats.nulls;

    let report = `# JSON分析报告: ${fileName}\n\n`;
    report += `**生成时间:** ${reportDate}\n`;
    report += `**文件路径:** ${filePath}\n`;
    report += `**文件大小:** ${this.formatFileSize(this.stats.totalSize)}\n`;
    report += `**处理时间:** ${this.stats.processingTime}ms\n\n`;

    // 基本统计
    report += `## 📊 基本统计\n\n`;
    report += `| 指标 | 数量 |\n`;
    report += `|------|------|\n`;
    report += `| **总元素数** | ${totalElements} |\n`;
    report += `| **对象数** | ${this.stats.objects} |\n`;
    report += `| **数组数** | ${this.stats.arrays} |\n`;
    report += `| **字符串数** | ${this.stats.strings} |\n`;
    report += `| **数字数** | ${this.stats.numbers} |\n`;
    report += `| **布尔值数** | ${this.stats.booleans} |\n`;
    report += `| **空值数** | ${this.stats.nulls} |\n`;
    report += `| **最大深度** | ${this.stats.maxDepth} |\n`;
    report += `| **唯一键数** | ${this.stats.keyFrequency.size} |\n\n`;

    // 数据类型分布
    if (totalElements > 0) {
      report += `## 🎯 数据类型分布\n\n`;
      report += `| 类型 | 数量 | 百分比 |\n`;
      report += `|------|------|--------|\n`;
      report += `| **对象** | ${this.stats.objects} | ${((this.stats.objects / totalElements) * 100).toFixed(1)}% |\n`;
      report += `| **数组** | ${this.stats.arrays} | ${((this.stats.arrays / totalElements) * 100).toFixed(1)}% |\n`;
      report += `| **字符串** | ${this.stats.strings} | ${((this.stats.strings / totalElements) * 100).toFixed(1)}% |\n`;
      report += `| **数字** | ${this.stats.numbers} | ${((this.stats.numbers / totalElements) * 100).toFixed(1)}% |\n`;
      report += `| **布尔值** | ${this.stats.booleans} | ${((this.stats.booleans / totalElements) * 100).toFixed(1)}% |\n`;
      report += `| **空值** | ${this.stats.nulls} | ${((this.stats.nulls / totalElements) * 100).toFixed(1)}% |\n\n`;
    }

    // 最频繁的键
    if (this.stats.keyFrequency.size > 0) {
      report += `## 🔑 最频繁的键\n\n`;
      const sortedKeys = Array.from(this.stats.keyFrequency.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 20);

      sortedKeys.forEach(([key, count]) => {
        report += `- **\`${key}\`:** 出现 ${count} 次\n`;
      });
      report += `\n`;
    }

    // 最重要的路径
    if (this.stats.paths.size > 0) {
      report += `## 🗺️ 重要路径 (按出现频率)\n\n`;
      const sortedPaths = Array.from(this.stats.paths.entries())
        .sort(([,a], [,b]) => b.count - a.count)
        .slice(0, 15);

      sortedPaths.forEach(([path, info]) => {
        report += `### \`${path}\`\n`;
        report += `- **类型:** ${info.type}\n`;
        report += `- **出现次数:** ${info.count}\n`;
        if (info.examples.length > 0) {
          const example = info.examples[0];
          const exampleStr = typeof example === 'string' ? `"${example}"` : JSON.stringify(example);
          report += `- **示例:** ${exampleStr}\n`;
        }
        report += `\n`;
      });
    }

    // 数组大小分析
    if (this.stats.arraySizes.size > 0) {
      report += `## 📏 数组大小分析\n\n`;
      const sortedArrays = Array.from(this.stats.arraySizes.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

      sortedArrays.forEach(([path, size]) => {
        report += `- **\`${path}\`:** ${size} 个元素\n`;
      });

      // 计算平均数组大小
      const avgArraySize = Array.from(this.stats.arraySizes.values()).reduce((a, b) => a + b, 0) /
                          this.stats.arraySizes.size;
      report += `\n**平均数组大小:** ${avgArraySize.toFixed(1)} 个元素\n\n`;
    }

    // 性能指标
    report += `## ⚡ 性能指标\n\n`;
    report += `- **处理时间:** ${this.stats.processingTime}ms\n`;
    report += `- **处理速度:** ${(this.stats.totalSize / 1024 / (this.stats.processingTime / 1000)).toFixed(2)} KB/s\n`;
    report += `- **内存效率:** 使用流式处理，内存占用低\n\n`;

    // 数据洞察
    report += `## 💡 数据洞察\n\n`;

    if (this.stats.maxDepth > 5) {
      report += `- **复杂嵌套结构:** 文件具有深层嵌套 (最大深度: ${this.stats.maxDepth})\n`;
    } else {
      report += `- **简单结构:** 文件嵌套层次较浅 (最大深度: ${this.stats.maxDepth})\n`;
    }

    if (this.stats.arrays > this.stats.objects) {
      report += `- **数组导向:** 数组数量多于对象，可能是列表型数据\n`;
    } else {
      report += `- **对象导向:** 对象数量多于数组，可能是结构型数据\n`;
    }

    if (this.stats.strings > this.stats.numbers) {
      report += `- **文本密集:** 字符串数量多于数字，包含大量文本内容\n`;
    } else {
      report += `- **数值密集:** 数字数量多于字符串，包含大量数值数据\n`;
    }

    // 估算数据密度
    const density = totalElements / (this.stats.totalSize / 1024);
    if (density > 10) {
      report += `- **高密度数据:** 每KB约 ${density.toFixed(1)} 个元素\n`;
    } else {
      report += `- **低密度数据:** 每KB约 ${density.toFixed(1)} 个元素\n`;
    }

    report += `\n---\n\n*报告由 JSON Analyzer 生成，使用 stream-json 和 stream-chain 技术栈*`;

    return report;
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 保存分析报告到文件
   */
  async saveReport(report, outputPath) {
    await fs.promises.writeFile(outputPath, report, 'utf8');
    console.log(`📊 分析报告已保存到: ${outputPath}`);
  }

  /**
   * 打印分析报告摘要
   */
  printSummary(report) {
    const fileName = path.basename(report.filePath);
    console.log('\n=== JSON文件分析报告 ===');
    console.log(`📄 文件: ${fileName}`);
    console.log(`📏 大小: ${report.fileSize}`);
    console.log(`⏱️  处理时间: ${report.processingTime}ms`);
    console.log(`📊 总元素数: ${report.totalElements}`);
    console.log(`🔑 唯一键数: ${report.uniqueKeys}`);
    console.log(`📈 最大深度: ${report.maxDepth}`);
    console.log(`💾 处理速度: ${report.processingSpeed} KB/s`);
  }

  /**
   * 批量分析多个文件
   */
  async analyzeMultipleFiles(filePaths) {
    const results = [];

    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          console.log(`\n🚀 开始分析: ${filePath}`);
          const report = await this.analyzeJSON(filePath);

          // 保存Markdown报告
          const outputFileName = `analysis-${path.basename(filePath, '.json')}.md`;
          await this.saveReport(report, outputFileName);

          results.push({
            filePath,
            success: true,
            reportPath: outputFileName
          });

          // 打印摘要
          this.printSummary({
            filePath,
            fileSize: this.formatFileSize(this.stats.totalSize),
            processingTime: this.stats.processingTime,
            totalElements: this.stats.objects + this.stats.arrays + this.stats.strings +
                           this.stats.numbers + this.stats.booleans + this.stats.nulls,
            uniqueKeys: this.stats.keyFrequency.size,
            maxDepth: this.stats.maxDepth,
            processingSpeed: (this.stats.totalSize / 1024 / (this.stats.processingTime / 1000)).toFixed(2)
          });

          // 重置统计信息以备下次分析
          this.stats = {
            totalSize: 0,
            rootKeys: 0,
            objects: 0,
            arrays: 0,
            strings: 0,
            numbers: 0,
            booleans: 0,
            nulls: 0,
            topLevelKeys: [],
            keyFrequency: new Map(),
            valueFrequency: new Map(),
            arraySizes: new Map(),
            objectDepths: new Map(),
            paths: new Map(),
            maxDepth: 0,
            processingTime: 0
          };

        } else {
          console.log(`❌ 文件不存在: ${filePath}`);
          results.push({
            filePath,
            success: false,
            error: 'File not found'
          });
        }
      } catch (error) {
        console.error(`❌ 分析失败 ${filePath}:`, error.message);
        results.push({
          filePath,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }
}

// 如果直接运行此文件，执行分析
if (import.meta.url === `file://${process.argv[1]}`) {
  async function main() {
    const analyzer = new JSONAnalyzer();

    // 要分析的文件列表
    const files = [
      'D:\\projects\\large-json-reader-writor\\test-output.json',
      'D:\\projects\\large-json-reader-writor\\large-example.json',
      'D:\\projects\\large-json-reader-writor\\openapi.json'
    ];

    console.log('🎯 JSON Analyzer - 使用 stream-json 和 stream-chain 进行流式分析\n');

    try {
      const results = await analyzer.analyzeMultipleFiles(files);

      console.log('\n=== 分析完成 ===');
      console.log(`✅ 成功分析: ${results.filter(r => r.success).length} 个文件`);
      console.log(`❌ 失败: ${results.filter(r => !r.success).length} 个文件`);

      results.forEach(result => {
        if (result.success) {
          console.log(`✅ ${result.filePath} -> ${result.reportPath}`);
        } else {
          console.log(`❌ ${result.filePath}: ${result.error}`);
        }
      });

    } catch (error) {
      console.error('❌ 分析过程中发生错误:', error);
      process.exit(1);
    }
  }

  main();
}