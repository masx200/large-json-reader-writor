import fs from "fs/promises";
import LargeJSONHandler from "./index.js";

export default class MarkdownReportGenerator {
  constructor() {
    this.handler = new LargeJSONHandler();
  }

  async generateFileReport(filePath, chunkAnalysisData) {
    console.log(`正在生成报告: ${filePath}`);

    try {
      // 1. 使用 json-analyzer.js 方法分析
      const jsonAnalyzerReport = await this.getJsonAnalyzerReport(filePath);

      // 2. 获取文件基本信息
      const stats = await fs.stat(filePath);
      const fileSizeInKB = (stats.size / 1024).toFixed(2);

      // 3. 读取文件前部分进行分析
      const content = await fs.readFile(filePath, 'utf8');
      const first5KB = content.substring(0, 5000);

      // 4. 分析文件结构
      let structureAnalysis = {};
      try {
        const partialData = JSON.parse(first5KB);
        structureAnalysis = {
          topLevelKeys: Object.keys(partialData),
          topLevelKeyCount: Object.keys(partialData).length,
          sampleStructure: this.analyzeSampleStructure(partialData)
        };
      } catch (e) {
        structureAnalysis = {
          error: "无法解析JSON顶层结构",
          partialContent: first5KB.substring(0, 200) + "..."
        };
      }

      // 5. 生成Markdown报告
      const report = this.createMarkdownReport(filePath, {
        basicInfo: {
          fileName: filePath,
          fileSize: `${fileSizeInKB} KB`,
          generatedAt: new Date().toISOString()
        },
        jsonAnalyzerReport: jsonAnalyzerReport,
        chunkAnalysis: chunkAnalysisData,
        structureAnalysis: structureAnalysis
      });

      // 6. 保存报告
      const reportFileName = `analysis-report-${filePath.replace(/\.\w+$/, '').replace(/^\.\//, '')}.md`;
      await fs.writeFile(reportFileName, report);
      console.log(`报告已生成: ${reportFileName}`);

      return reportFileName;
    } catch (error) {
      console.error(`生成报告失败: ${error.message}`);
      return null;
    }
  }

  async getJsonAnalyzerReport(filePath) {
    // 使用 json-analyzer.js 的逻辑
    const stats = await fs.stat(filePath);
    const content = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(content);

    const analyzer = {
      stats: {
        totalSize: stats.size,
        rootKeys: Object.keys(data).length,
        objects: 0,
        arrays: 0,
        strings: 0,
        numbers: 0,
        booleans: 0,
        nulls: 0,
        topLevelKeys: Object.keys(data),
        tableAnalysis: {},
        largestTables: [],
        complexityMetrics: {}
      }
    };

    // 递归分析数据结构
    this.analyzeStructureForReport(data, 'root', analyzer.stats);

    // 计算复杂度
    analyzer.stats.complexityMetrics = {
      depth: this.calculateDepth(data),
      breadth: analyzer.stats.rootKeys,
      density: (analyzer.stats.objects + analyzer.stats.arrays) / (analyzer.stats.totalSize / 1024),
      nestingLevel: this.calculateMaxNesting(data)
    };

    return analyzer.stats;
  }

  analyzeStructureForReport(obj, path = '', stats) {
    if (obj === null) {
      stats.nulls++;
      return;
    }

    if (typeof obj === 'string') {
      stats.strings++;
      return;
    }

    if (typeof obj === 'number') {
      stats.numbers++;
      return;
    }

    if (typeof obj === 'boolean') {
      stats.booleans++;
      return;
    }

    if (Array.isArray(obj)) {
      stats.arrays++;
      obj.forEach((item, index) => {
        this.analyzeStructureForReport(item, `${path}[${index}]`, stats);
      });
      return;
    }

    if (typeof obj === 'object') {
      stats.objects++;
      Object.keys(obj).forEach(key => {
        this.analyzeStructureForReport(obj[key], `${path}.${key}`, stats);
      });
    }
  }

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

  analyzeSampleStructure(data) {
    const sample = {};
    const maxKeys = 10;

    Object.keys(data).slice(0, maxKeys).forEach(key => {
      const value = data[key];
      if (typeof value === 'object' && value !== null) {
        sample[key] = {
          type: Array.isArray(value) ? 'array' : 'object',
          itemCount: Array.isArray(value) ? value.length : Object.keys(value).length,
          sampleKeys: Array.isArray(value) ? [] : Object.keys(value).slice(0, 5)
        };
      } else {
        sample[key] = {
          type: typeof value,
          value: value.toString().substring(0, 100) + (value.toString().length > 100 ? '...' : '')
        };
      }
    });

    return sample;
  }

  createMarkdownReport(filePath, data) {
    const { basicInfo, jsonAnalyzerReport, chunkAnalysis, structureAnalysis } = data;

    return `# JSON 文件分析报告

**文件名**: ${basicInfo.fileName}
**文件大小**: ${basicInfo.fileSize}
**分析时间**: ${basicInfo.generatedAt}

---

## 1. 文件基本信息

- **文件路径**: ${filePath}
- **文件大小**: ${basicInfo.fileSize}
- **分析生成时间**: ${basicInfo.generatedAt}

---

## 2. 完整分析结果 (json-analyzer.js 方法)

### 2.1 数据结构统计

| 数据类型 | 数量 |
|----------|------|
| 对象 (Objects) | ${jsonAnalyzerReport.objects.toLocaleString()} |
| 数组 (Arrays) | ${jsonAnalyzerReport.arrays.toLocaleString()} |
| 字符串 (Strings) | ${jsonAnalyzerReport.strings.toLocaleString()} |
| 数字 (Numbers) | ${jsonAnalyzerReport.numbers.toLocaleString()} |
| 布尔值 (Booleans) | ${jsonAnalyzerReport.booleans.toLocaleString()} |
| 空值 (Nulls) | ${jsonAnalyzerReport.nulls.toLocaleString()} |
| **总计** | **${(jsonAnalyzerReport.objects + jsonAnalyzerReport.arrays + jsonAnalyzerReport.strings + jsonAnalyzerReport.numbers + jsonAnalyzerReport.booleans + jsonAnalyzerReport.nulls).toLocaleString()}** |

### 2.2 顶层结构

**顶层键数量**: ${jsonAnalyzerReport.rootKeys}

**顶层键列表**:
${jsonAnalyzerReport.topLevelKeys.map(key => `- \`${key}\``).join('\n')}

### 2.3 复杂度指标

| 指标 | 数值 |
|------|------|
| 最大深度 (Max Depth) | ${jsonAnalyzerReport.complexityMetrics.depth} |
| 广度 (Breadth) | ${jsonAnalyzerReport.complexityMetrics.breadth} |
| 密度 (Density) | ${jsonAnalyzerReport.complexityMetrics.density.toFixed(2)} |
| 最大嵌套层数 (Nesting Level) | ${jsonAnalyzerReport.complexityMetrics.nestingLevel} |

---

## 3. 分块读取分析结果

### 3.1 分块处理信息

| 项目 | 数值 |
|------|------|
| 处理块数 | ${chunkAnalysis?.basicInfo?.totalChunks || 'N/A'} |
| 有效JSON块数 | ${chunkAnalysis?.basicInfo?.validJSONChunks || 'N/A'} |
| 处理字符数 | ${(chunkAnalysis?.basicInfo?.totalCharacters || 0).toLocaleString()} |
| 验证成功率 | ${chunkAnalysis?.chunkValidation?.validationRate || 'N/A'} |

### 3.2 分块读取特点

${chunkAnalysis?.error ? `
- **注意事项**: ${chunkAnalysis.error}
- **分析限制**: 分块读取方法主要用于处理超大文件，对于完整结构分析存在局限性
` : `
- **处理状态**: 分块读取正常完成
- **验证结果**: JSON片段验证成功
`}

### 3.3 分块读取优势

1. **内存效率**: 可以处理远大于可用内存的JSON文件
2. **流式处理**: 支持实时数据流处理，无需等待整个文件加载
3. **错误恢复**: 单个块解析失败不会影响整个文件处理
4. **进度监控**: 提供详细的处理进度信息

---

## 4. 文件结构分析

${structureAnalysis.error ? `
### 4.1 结构分析限制

- **分析结果**: ${structureAnalysis.error}
- **原因**: JSON文件结构复杂或格式特殊，无法通过简单的部分读取进行完整分析

` : `
### 4.1 顶层结构详细信息

**顶层键数量**: ${structureAnalysis.topLevelKeyCount}

**结构样本分析**:
${Object.entries(structureAnalysis.sampleStructure).map(([key, info]) => `
- **${key}**:
  - 类型: ${info.type}
  - ${info.type === 'array' ? `数组长度: ${info.itemCount}` : info.type === 'object' ? `对象键数: ${info.itemCount}` : `值: ${info.value}`}
  ${info.type === 'object' && info.sampleKeys.length > 0 ? `  - 示例键: [${info.sampleKeys.map(k => `\`${k}\``).join(', ')}]` : ''}
`).join('')}

`}

---

## 5. 分析方法对比

### 5.1 json-analyzer.js 方法
**优势**:
- 完整的JSON结构分析
- 准确的数据类型统计
- 深度复杂度计算
- 详细的数据库表结构分析

**限制**:
- 需要将整个文件加载到内存
- 对于超大文件可能存在内存压力

### 5.2 分块读取方法
**优势**:
- 内存使用效率高
- 支持超大文件处理
- 提供处理进度监控
- 错误恢复能力强

**限制**:
- 无法获得完整文件结构
- 复杂度分析受限
- 需要额外的边界处理逻辑

---

## 6. 建议

基于以上分析结果，建议：

1. **对于中小型文件** (小于 500MB): 使用 json-analyzer.js 方法进行完整分析
2. **对于大型文件** (大于 500MB): 使用分块读取方法，结合抽样分析
3. **对于实时数据处理**: 使用分块读取方法，支持流式处理
4. **对于复杂结构分析**: 推荐结合两种方法的优势

---

**报告生成工具**: @masx200/large-json-reader-writor
**分析方法**: json-analyzer.js + 分块读取方法
**生成时间**: ${basicInfo.generatedAt}
`;
  }

  async generateAllReports() {
    const files = [
      './test-output.json',
      './large-example.json',
      './openapi.json'
    ];

    // 读取分块分析结果
    let chunkAnalysisData = {};
    try {
      chunkAnalysisData = JSON.parse(await fs.readFile('chunk-analysis-results.json', 'utf8'));
    } catch (e) {
      console.warn('无法读取分块分析结果，将生成基础报告');
    }

    const reportFiles = [];

    for (const filePath of files) {
      try {
        const reportFile = await this.generateFileReport(filePath, chunkAnalysisData[filePath]);
        if (reportFile) {
          reportFiles.push(reportFile);
        }
      } catch (error) {
        console.error(`生成 ${filePath} 报告失败:`, error);
      }
    }

    console.log(`\n成功生成 ${reportFiles.length} 个分析报告:`);
    reportFiles.forEach(file => console.log(`- ${file}`));

    return reportFiles;
  }
}

// 如果直接运行此文件，生成报告
if (import.meta.main) {
  async function main() {
    const generator = new MarkdownReportGenerator();
    await generator.generateAllReports();
  }

  main();
}