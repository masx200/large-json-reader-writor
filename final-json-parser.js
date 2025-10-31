import fs from "fs";

export default class FinalJSONParser {
  constructor() {
    this.results = {
      topLevelKeys: [],
      structure: {},
      maxDepth: 0,
      totalElements: 0,
      typeCounts: {
        objects: 0,
        arrays: 0,
        strings: 0,
        numbers: 0,
        booleans: 0,
        nulls: 0
      }
    };
  }

  /**
   * 最终版JSON解析器 - 结合多种方法
   */
  async parseJSON(filePath, options = {}) {
    const {
      chunkSize = 1024 * 20, // 20KB
      method = 'auto', // auto, direct, streaming
      deepAnalysis = true
    } = options;

    console.log(`🔍 开始最终JSON解析: ${filePath}`);

    try {
      const stats = fs.statSync(filePath);
      const fileSizeKB = (stats.size / 1024).toFixed(2);
      console.log(`📏 文件大小: ${fileSizeKB} KB`);

      // 根据文件大小和方法选择解析策略
      let result;
      if (method === 'direct' || (method === 'auto' && stats.size < 100 * 1024)) {
        console.log('📂 使用直接解析方法');
        result = await this.directParse(filePath);
      } else if (method === 'streaming' || method === 'auto') {
        console.log('📦 使用智能分块解析方法');
        result = await this.smartChunkParse(filePath, {
          chunkSize,
          deepAnalysis
        });
      } else {
        throw new Error(`未知的解析方法: ${method}`);
      }

      return {
        ...result,
        fileSizeKB,
        method: result.method,
        parseTime: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ 解析失败:', error);
      return {
        success: false,
        method: "最终JSON解析",
        error: error.message,
        fileSizeKB: 0
      };
    }
  }

  /**
   * 直接解析（小文件）
   */
  async directParse(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);

      // 重置统计
      this.resetStats();

      // 完整结构分析
      this.analyzeCompleteStructure(data);

      return {
        success: true,
        method: "直接解析",
        topLevelKeys: Object.keys(data),
        structure: this.results.structure,
        stats: {
          maxDepth: this.results.maxDepth,
          totalElements: this.results.totalElements,
          typeDistribution: { ...this.results.typeCounts }
        },
        complexity: {
          depth: this.results.maxDepth,
          breadth: Object.keys(data).length,
          density: (this.results.typeCounts.objects + this.results.typeCounts.arrays) / (fs.statSync(filePath).size / 1024)
        }
      };
    } catch (error) {
      return {
        success: false,
        method: "直接解析",
        error: error.message
      };
    }
  }

  /**
   * 智能分块解析（大文件）
   */
  async smartChunkParse(filePath, options = {}) {
    const { chunkSize, deepAnalysis } = options;
    const content = fs.readFileSync(filePath, 'utf8');
    const totalSize = content.length;

    console.log(`📦 开始智能分块解析，总大小: ${totalSize} 字符`);

    // 策略1: 尝试解析完整JSON（如果文件不是特别大）
    if (totalSize < 1024 * 1024) { // 小于1MB
      try {
        const data = JSON.parse(content);
        this.resetStats();
        this.analyzeCompleteStructure(data);

        return {
          success: true,
          method: "智能分块解析（完整模式）",
          topLevelKeys: Object.keys(data),
          structure: this.results.structure,
          stats: {
            maxDepth: this.results.maxDepth,
            totalElements: this.results.totalElements,
            typeDistribution: { ...this.results.typeCounts }
          },
          complexity: {
            depth: this.results.maxDepth,
            breadth: Object.keys(data).length,
            density: (this.results.typeCounts.objects + this.results.typeCounts.arrays) / (fs.statSync(filePath).size / 1024)
          }
        };
      } catch (e) {
        console.log('⚠️  完整解析失败，启用分块模式');
      }
    }

    // 策略2: 分块解析
    return this.chunkBasedParse(content, filePath, { chunkSize, deepAnalysis });
  }

  /**
   * 基于块的解析
   */
  chunkBasedParse(content, filePath, options = {}) {
    const { chunkSize, deepAnalysis } = options;
    const chunks = this.createChunks(content, chunkSize);

    console.log(`📦 分割为 ${chunks.length} 个块进行处理`);

    const allKeys = new Set();
    const allStructures = [];
    let maxDepth = 0;

    // 处理每个块
    for (let i = 0; i < chunks.length; i++) {
      console.log(`处理块 ${i + 1}/${chunks.length}...`);

      const chunkResult = this.parseChunk(chunks[i]);
      if (chunkResult.success) {
        chunkResult.keys.forEach(key => allKeys.add(key));
        allStructures.push(chunkResult.structure);
        maxDepth = Math.max(maxDepth, chunkResult.maxDepth);
      }
    }

    // 合并结构信息
    const mergedStructure = this.mergeStructures(allStructures);
    const topLevelKeys = Array.from(allKeys);

    // 深度分析（如果启用）
    let deepPaths = [];
    if (deepAnalysis && topLevelKeys.length > 0) {
      deepPaths = this.extractDeepPaths(content, topLevelKeys.slice(0, 10));
    }

    return {
      success: true,
      method: "智能分块解析",
      topLevelKeys: topLevelKeys,
      structure: mergedStructure,
      deepPaths: deepPaths,
      stats: {
        chunksProcessed: chunks.length,
        topLevelKeyCount: topLevelKeys.length,
        maxDepth: maxDepth,
        deepPathsFound: deepPaths.length
      },
      complexity: {
        depth: maxDepth,
        breadth: topLevelKeys.length,
        density: topLevelKeys.length / (fs.statSync(filePath).size / 1024)
      }
    };
  }

  /**
   * 创建智能块
   */
  createChunks(content, maxChunkSize) {
    const chunks = [];
    let start = 0;

    while (start < content.length) {
      // 查找完整的JSON对象
      let end = Math.min(start + maxChunkSize, content.length);

      // 尝试找到完整的对象边界
      if (content[start] === '{') {
        const objEnd = this.findJsonObjectEnd(content, start);
        if (objEnd !== -1 && objEnd <= start + maxChunkSize) {
          end = objEnd + 1;
        }
      }

      chunks.push(content.substring(start, end));
      start = end;

      // 限制块数以避免过度处理
      if (chunks.length >= 50) {
        console.log('⚠️  达到最大块数限制，停止分块');
        break;
      }
    }

    return chunks;
  }

  /**
   * 查找JSON对象结束位置
   */
  findJsonObjectEnd(content, startPos) {
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = startPos; i < content.length; i++) {
      const char = content[i];

      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            return i; // 找到匹配的结束括号
          }
        } else if (char === '"' && !escapeNext) {
          inString = true;
        }
        escapeNext = false;
      } else {
        if (char === '"' && !escapeNext) {
          inString = false;
        }
        if (char === '\\' && !escapeNext) {
          escapeNext = true;
        } else {
          escapeNext = false;
        }
      }
    }

    return -1; // 找不到完整对象
  }

  /**
   * 解析单个块
   */
  parseChunk(chunk) {
    try {
      // 方法1: 尝试直接解析整个块
      try {
        const data = JSON.parse(chunk);
        this.resetStats();
        this.analyzeCompleteStructure(data);

        return {
          success: true,
          keys: Object.keys(data),
          structure: this.results.structure,
          maxDepth: this.results.maxDepth
        };
      } catch (e) {
        // 继续其他方法
      }

      // 方法2: 提取JSON键名
      const keys = this.extractKeysFromPartialJSON(chunk);
      if (keys.length > 0) {
        const structure = {};
        keys.forEach(key => {
          structure[key] = { type: 'unknown', extracted: true };
        });

        return {
          success: true,
          keys: keys,
          structure: structure,
          maxDepth: 1
        };
      }

      return {
        success: false,
        keys: [],
        structure: {},
        maxDepth: 0
      };
    } catch (error) {
      return {
        success: false,
        keys: [],
        structure: {},
        maxDepth: 0,
        error: error.message
      };
    }
  }

  /**
   * 从部分JSON中提取键名
   */
  extractKeysFromPartialJSON(content) {
    const keys = [];
    const firstBrace = content.indexOf('{');

    if (firstBrace === -1) {
      return [];
    }

    const afterBrace = content.substring(firstBrace + 1);
    // 使用正则表达式提取键名
    const keyMatches = afterBrace.match(/"([^"]+)":/g);

    if (keyMatches) {
      keyMatches.forEach(match => {
        const key = match.replace(/"/g, '').replace(':', '');
        if (key.length > 0 && !keys.includes(key)) {
          keys.push(key);
        }
      });
    }

    return keys;
  }

  /**
   * 完整结构分析
   */
  analyzeCompleteStructure(data, path = '', depth = 0) {
    if (depth > this.results.maxDepth) {
      this.results.maxDepth = depth;
    }

    if (data === null) {
      this.results.typeCounts.nulls++;
      this.results.totalElements++;
    } else if (typeof data === 'string') {
      this.results.typeCounts.strings++;
      this.results.totalElements++;
    } else if (typeof data === 'number') {
      this.results.typeCounts.numbers++;
      this.results.totalElements++;
    } else if (typeof data === 'boolean') {
      this.results.typeCounts.booleans++;
      this.results.totalElements++;
    } else if (Array.isArray(data)) {
      this.results.typeCounts.arrays++;
      this.results.totalElements++;

      data.forEach((item, index) => {
        this.analyzeCompleteStructure(item, `${path}[${index}]`, depth + 1);
      });
    } else if (typeof data === 'object') {
      this.results.typeCounts.objects++;
      this.results.totalElements++;

      Object.keys(data).forEach(key => {
        this.analyzeCompleteStructure(data[key], `${path}.${key}`, depth + 1);
      });
    }
  }

  /**
   * 提取深层路径
   */
  extractDeepPaths(content, targetKeys) {
    const deepPaths = [];

    try {
      // 尝试解析完整JSON
      const data = JSON.parse(content);

      const findPaths = (obj, currentPath = '', currentDepth = 0) => {
        if (currentDepth > 5) return; // 限制深度

        if (typeof obj === 'object' && obj !== null) {
          Object.keys(obj).forEach(key => {
            if (targetKeys.includes(key)) {
              const path = currentPath ? `${currentPath}.${key}` : key;
              deepPaths.push({
                path: path,
                depth: currentDepth,
                type: typeof obj[key]
              });
            }

            // 递归查找
            if (typeof obj[key] === 'object' && obj[key] !== null) {
              findPaths(obj[key], currentPath ? `${currentPath}.${key}` : key, currentDepth + 1);
            } else if (Array.isArray(obj[key])) {
              deepPaths.push({
                path: `${currentPath ? `${currentPath}.${key}` : key}`,
                depth: currentDepth,
                type: 'array',
                length: obj[key].length
              });
            }
          });
        }
      };

      findPaths(data);

    } catch (error) {
      console.log('深层路径解析失败:', error.message);
    }

    return deepPaths;
  }

  /**
   * 合并结构
   */
  mergeStructures(structures) {
    const merged = {};

    structures.forEach(structure => {
      Object.entries(structure).forEach(([key, info]) => {
        if (!merged[key]) {
          merged[key] = info;
        }
      });
    });

    return merged;
  }

  /**
   * 重置统计
   */
  resetStats() {
    this.results = {
      topLevelKeys: [],
      structure: {},
      maxDepth: 0,
      totalElements: 0,
      typeCounts: {
        objects: 0,
        arrays: 0,
        strings: 0,
        numbers: 0,
        booleans: 0,
        nulls: 0
      }
    };
  }
}