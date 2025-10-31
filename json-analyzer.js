import fs from "fs/promises";
import LargeJSONHandler from "./index.js";

export default class JSONAnalyzer {
  constructor() {
    this.handler = new LargeJSONHandler();
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
      tableAnalysis: {},
      largestTables: [],
      complexityMetrics: {}
    };
  }

  /**
   * 分析JSON文件
   * @param {string} filePath - JSON文件路径
   * @returns {Promise<object>} - 分析报告
   */
  async analyzeJSON(filePath) {
    console.log(`开始分析JSON文件: ${filePath}`);

    // 获取文件大小
    const stats = await fs.stat(filePath);
    this.stats.totalSize = stats.size;

    // 读取文件内容
    const content = await fs.readFile(filePath, 'utf8');
    console.log(`文件大小: ${(this.stats.totalSize / 1024).toFixed(2)} KB`);

    // 解析JSON
    const data = JSON.parse(content);

    // 分析顶层结构
    this.analyzeTopLevel(data);

    // 递归分析数据结构
    this.analyzeStructure(data, 'root');

    // 分析数据库表结构
    this.analyzeTables(data);

    // 计算复杂度指标
    this.calculateComplexity(data);

    return this.generateReport();
  }

  /**
   * 分析顶层结构
   */
  analyzeTopLevel(data) {
    if (typeof data === 'object' && data !== null) {
      this.stats.rootKeys = Object.keys(data).length;
      this.stats.topLevelKeys = Object.keys(data);
      console.log(`顶层键数量: ${this.stats.rootKeys}`);
    }
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
   * 生成分析报告
   */
  generateReport() {
    const report = {
      // 基本信息
      basicInfo: {
        fileSize: `${(this.stats.totalSize / 1024).toFixed(2)} KB`,
        totalKeys: this.stats.rootKeys,
        generatedAt: new Date().toISOString()
      },

      // 数据结构统计
      dataStructure: {
        objects: this.stats.objects,
        arrays: this.stats.arrays,
        strings: this.stats.strings,
        numbers: this.stats.numbers,
        booleans: this.stats.booleans,
        nulls: this.stats.nulls,
        totalElements: this.stats.objects + this.stats.arrays + this.stats.strings +
                     this.stats.numbers + this.stats.booleans + this.stats.nulls
      },

      // 顶层键
      topLevelKeys: this.stats.topLevelKeys,

      // 表分析
      tableAnalysis: {
        totalTables: Object.keys(this.stats.tableAnalysis).length,
        tablesWithData: Object.values(this.stats.tableAnalysis).filter(t => t.hasRecords).length,
        emptyTables: Object.values(this.stats.tableAnalysis).filter(t => t.isEmpty).length,
        largestTables: this.stats.largestTables.slice(0, 10),
        detailedAnalysis: this.stats.tableAnalysis
      },

      // 复杂度指标
      complexity: this.stats.complexityMetrics,

      // 总结
      summary: {
        type: 'Database Export',
        format: 'Per-table JSON structure',
        encoding: 'UTF-8',
        structure: 'Each table contained in separate top-level object'
      }
    };

    return report;
  }

  /**
   * 保存分析报告到文件
   */
  async saveReport(report, outputPath = 'json-analysis-report.json') {
    const prettyReport = JSON.stringify(report, null, 2);
    await fs.writeFile(outputPath, prettyReport, 'utf8');
    console.log(`分析报告已保存到: ${outputPath}`);
  }

  /**
   * 打印分析报告摘要
   */
  printSummary(report) {
    console.log('\n=== JSON文件分析报告 ===');
    console.log(`文件大小: ${report.basicInfo.fileSize}`);
    console.log(`顶层键数量: ${report.basicInfo.totalKeys}`);
    console.log(`数据表总数: ${report.tableAnalysis.totalTables}`);
    console.log(`有数据的表: ${report.tableAnalysis.tablesWithData}`);
    console.log(`空表数量: ${report.tableAnalysis.emptyTables}`);

    console.log('\n数据结构统计:');
    console.log(`- 对象: ${report.dataStructure.objects}`);
    console.log(`- 数组: ${report.dataStructure.arrays}`);
    console.log(`- 字符串: ${report.dataStructure.strings}`);
    console.log(`- 数字: ${report.dataStructure.numbers}`);
    console.log(`- 布尔值: ${report.dataStructure.booleans}`);
    console.log(`- 空值: ${report.dataStructure.nulls}`);

    console.log('\n最大的10个表:');
    report.tableAnalysis.largestTables.slice(0, 10).forEach((table, index) => {
      console.log(`${index + 1}. ${table.name}: ${table.recordCount} 条记录`);
    });

    console.log('\n复杂度指标:');
    console.log(`- 最大深度: ${report.complexity.depth}`);
    console.log(`- 广度: ${report.complexity.breadth}`);
    console.log(`- 密度: ${report.complexity.density.toFixed(2)}`);
    console.log(`- 最大嵌套层数: ${report.complexity.nestingLevel}`);
  }
}

// 如果直接运行此文件，执行分析
if (import.meta.main) {
  async function main() {
    const analyzer = new JSONAnalyzer();

    try {
      const filePath = process.argv[2] || './test-output.json';
      const report = await analyzer.analyzeJSON(filePath);

      // 打印摘要
      analyzer.printSummary(report);

      // 保存完整报告
      await analyzer.saveReport(report);

      console.log('\n完整分析报告已生成: json-analysis-report.json');

    } catch (error) {
      console.error('分析失败:', error);
      process.exit(1);
    }
  }

  main();
}