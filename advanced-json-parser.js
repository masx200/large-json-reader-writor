import fs from "fs";
import streamChain from "stream-chain";
import streamJson from "stream-json";
import { streamObject } from "stream-json/streamers/StreamObject.js";
import { streamValues } from "stream-json/streamers/StreamValues.js";

const { chain } = streamChain;
const { parser } = streamJson;

export default class AdvancedJSONParser {
  constructor() {
    this.results = {
      topLevelKeys: [],
      structure: {},
      paths: [],
      maxDepth: 0,
      complexity: {}
    };
  }

  /**
   * 使用stream-json库流式解析JSON文件
   */
  async parseWithStreamJSON(filePath, options = {}) {
    const {
      chunkSize = 1024 * 20, // 20KB chunks
      maxPaths = 1000,
      progressCallback = null
    } = options;

    console.log(`开始流式解析: ${filePath}`);
    console.log(`块大小: ${chunkSize} bytes`);

    return new Promise((resolve, reject) => {
      const stats = fs.statSync(filePath);
      const totalSize = stats.size;
      let processedSize = 0;

      // 创建流式JSON解析管道
      const pipeline = chain([
        fs.createReadStream(filePath, { highWaterMark: chunkSize }),
        parser(),
        streamObject()
      ]);

      let structure = {};
      let topLevelKeys = new Set();
      let maxDepth = 0;
      let totalElements = 0;
      let pathCounts = {};

      pipeline.on('data', (data) => {
        // 更新处理进度
        processedSize += JSON.stringify(data).length;
        if (progressCallback) {
          progressCallback(processedSize, totalSize);
        }

        // 分析对象结构
        if (data.key && data.value !== undefined) {
          topLevelKeys.add(data.key);
          this.analyzeObject(data.key, data.value, structure, pathCounts, 0);
          totalElements++;
        }
      });

      pipeline.on('end', () => {
        const result = {
          success: true,
          method: "stream-json流式解析",
          topLevelKeys: Array.from(topLevelKeys),
          structure: structure,
          stats: {
            totalSize: totalSize,
            processedSize: processedSize,
            topLevelKeyCount: topLevelKeys.size,
            totalElements: totalElements,
            maxDepth: maxDepth,
            pathCounts: pathCounts
          },
          complexity: this.calculateComplexity(structure, topLevelKeys.size, totalSize)
        };

        console.log(`流式解析完成! 顶层键: ${topLevelKeys.size}, 元素: ${totalElements}`);
        resolve(result);
      });

      pipeline.on('error', (error) => {
        console.error('流式解析错误:', error);
        resolve({
          success: false,
          method: "stream-json流式解析",
          error: error.message,
          topLevelKeys: [],
          structure: {}
        });
      });
    });
  }

  /**
   * 递归分析对象结构
   */
  analyzeObject(key, value, structure, pathCounts, currentDepth, currentPath = '') {
    const path = currentPath ? `${currentPath}.${key}` : key;

    // 更新路径计数
    pathCounts[path] = (pathCounts[path] || 0) + 1;

    // 更新最大深度
    if (currentDepth > this.results.maxDepth) {
      this.results.maxDepth = currentDepth;
    }

    if (value === null || value === undefined) {
      structure[key] = { type: 'null', count: 1 };
    } else if (typeof value === 'string') {
      structure[key] = { type: 'string', count: 1, sample: value.substring(0, 50) };
    } else if (typeof value === 'number') {
      structure[key] = { type: 'number', count: 1 };
    } else if (typeof value === 'boolean') {
      structure[key] = { type: 'boolean', count: 1 };
    } else if (Array.isArray(value)) {
      structure[key] = {
        type: 'array',
        count: value.length,
        elementTypes: this.analyzeArrayTypes(value)
      };

      // 递归分析数组元素
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          this.analyzeObject(`[${index}]`, item, structure, pathCounts, currentDepth + 1, path);
        }
      });
    } else if (typeof value === 'object') {
      const keys = Object.keys(value);
      structure[key] = {
        type: 'object',
        count: keys.length,
        subKeys: keys.slice(0, 10) // 只存储前10个子键
      };

      // 递归分析子对象
      keys.forEach(subKey => {
        if (typeof value[subKey] === 'object' && value[subKey] !== null) {
          this.analyzeObject(subKey, value[subKey], structure, pathCounts, currentDepth + 1, path);
        }
      });
    }
  }

  /**
   * 分析数组元素类型
   */
  analyzeArrayTypes(array) {
    const types = {};
    array.forEach(item => {
      const type = Array.isArray(item) ? 'array' :
                    item === null ? 'null' :
                    typeof item;
      types[type] = (types[type] || 0) + 1;
    });
    return types;
  }

  /**
   * 计算复杂度指标
   */
  calculateComplexity(structure, topLevelKeyCount, totalSize) {
    let objectCount = 0;
    let arrayCount = 0;
    let stringCount = 0;
    let numberCount = 0;
    let booleanCount = 0;
    let nullCount = 0;

    Object.values(structure).forEach(item => {
      switch (item.type) {
        case 'object': objectCount++; break;
        case 'array': arrayCount++; break;
        case 'string': stringCount++; break;
        case 'number': numberCount++; break;
        case 'boolean': booleanCount++; break;
        case 'null': nullCount++; break;
      }
    });

    return {
      depth: this.results.maxDepth,
      breadth: topLevelKeyCount,
      density: (objectCount + arrayCount) / (totalSize / 1024),
      totalElements: objectCount + arrayCount + stringCount + numberCount + booleanCount + nullCount,
      typeDistribution: {
        objects: objectCount,
        arrays: arrayCount,
        strings: stringCount,
        numbers: numberCount,
        booleans: booleanCount,
        nulls: nullCount
      }
    };
  }

  /**
   * 使用块读取方法进行深度解析
   */
  async parseWithDeepChunkReading(filePath, options = {}) {
    const {
      chunkSize = 1024 * 20, // 20KB
      maxDepth = 5,
      progressCallback = null
    } = options;

    console.log(`开始深度块读取解析: ${filePath}`);
    console.log(`块大小: ${chunkSize}, 最大深度: ${maxDepth}`);

    try {
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      const content = fs.readFileSync(filePath, 'utf8');

      // 使用流式JSON解析器
      const result = await this.parseWithStreamJSON(filePath, {
        chunkSize: chunkSize,
        progressCallback: progressCallback
      });

      if (result.success) {
        return {
          ...result,
          method: "深度块读取解析",
          deepAnalysis: {
            deepPaths: this.extractDeepPaths(result.structure, maxDepth),
            nestedObjects: this.countNestedObjects(result.structure),
            complexityPatterns: this.analyzeComplexityPatterns(result.structure)
          }
        };
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('深度块读取解析失败:', error);
      return {
        success: false,
        method: "深度块读取解析",
        error: error.message
      };
    }
  }

  /**
   * 提取深层路径
   */
  extractDeepPaths(structure, maxDepth, currentPath = '', depth = 0) {
    const deepPaths = [];

    Object.entries(structure).forEach(([key, info]) => {
      const path = currentPath ? `${currentPath}.${key}` : key;

      if (depth >= maxDepth) {
        deepPaths.push({ path, depth, type: info.type });
      }

      if (info.subKeys && depth < maxDepth) {
        info.subKeys.forEach(subKey => {
          const subInfo = { type: 'unknown' }; // 简化处理
          const subPaths = this.extractDeepPaths({ [subKey]: subInfo }, maxDepth, path, depth + 1);
          deepPaths.push(...subPaths);
        });
      }
    });

    return deepPaths;
  }

  /**
   * 计算嵌套对象数量
   */
  countNestedObjects(structure, currentDepth = 0) {
    let count = 0;

    Object.values(structure).forEach(item => {
      if (item.type === 'object') {
        count++;
        if (item.subKeys) {
          count += this.countNestedObjects({
            ...item.subKeys.reduce((acc, key) => ({ ...acc, [key]: { type: 'object' } }), {})
          }, currentDepth + 1);
        }
      } else if (item.type === 'array' && item.elementTypes) {
        // 数组中包含的对象
        if (item.elementTypes.object) {
          count += item.elementTypes.object;
        }
      }
    });

    return count;
  }

  /**
   * 分析复杂度模式
   */
  analyzeComplexityPatterns(structure) {
    const patterns = {
      highlyNested: 0,
      largeArrays: 0,
      mixedTypes: 0,
      complexObjects: 0
    };

    Object.values(structure).forEach(item => {
      if (item.type === 'array' && item.count > 100) {
        patterns.largeArrays++;
      }
      if (item.type === 'object' && item.count > 20) {
        patterns.complexObjects++;
      }
      if (item.elementTypes && Object.keys(item.elementTypes).length > 2) {
        patterns.mixedTypes++;
      }
    });

    return patterns;
  }

  /**
   * 智能JSON解析器 - 自动选择最佳解析方法
   */
  async smartParseJSON(filePath, options = {}) {
    const stats = fs.statSync(filePath);
    const fileSizeKB = stats.size / 1024;

    console.log(`智能解析开始: ${filePath} (${fileSizeKB.toFixed(2)} KB)`);

    let result;

    if (fileSizeKB < 100) {
      // 小文件：直接解析
      console.log('使用直接解析方法');
      result = await this.parseDirect(filePath, options);
    } else if (fileSizeKB < 1024) {
      // 中等文件：流式解析
      console.log('使用流式解析方法');
      result = await this.parseWithStreamJSON(filePath, options);
    } else {
      // 大文件：深度块读取
      console.log('使用深度块读取解析方法');
      result = await this.parseWithDeepChunkReading(filePath, options);
    }

    return {
      ...result,
      fileSizeKB: fileSizeKB.toFixed(2),
      recommendedMethod: this.recommendMethod(fileSizeKB),
      parseTime: new Date().toISOString()
    };
  }

  /**
   * 直接解析（小文件）
   */
  async parseDirect(filePath, options = {}) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      const topLevelKeys = Object.keys(data);

      return {
        success: true,
        method: "直接解析",
        topLevelKeys: topLevelKeys,
        structure: this.analyzeStructureDirect(data),
        stats: {
          fileSizeKB: fs.statSync(filePath).size / 1024,
          topLevelKeyCount: topLevelKeys.length
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
   * 直接结构分析
   */
  analyzeStructureDirect(data, currentPath = '') {
    const structure = {};

    if (typeof data === 'object' && data !== null) {
      Object.keys(data).forEach(key => {
        const value = data[key];
        const path = currentPath ? `${currentPath}.${key}` : key;

        if (Array.isArray(value)) {
          structure[key] = {
            type: 'array',
            count: value.length,
            elementTypes: this.analyzeArrayTypes(value)
          };
        } else if (typeof value === 'object' && value !== null) {
          structure[key] = {
            type: 'object',
            count: Object.keys(value).length,
            subKeys: Object.keys(value).slice(0, 10),
            nestedStructure: this.analyzeStructureDirect(value, path)
          };
        } else {
          structure[key] = {
            type: typeof value,
            value: value !== null && value !== undefined ? value.toString().substring(0, 100) : 'null'
          };
        }
      });
    }

    return structure;
  }

  /**
   * 推荐解析方法
   */
  recommendMethod(fileSizeKB) {
    if (fileSizeKB < 100) {
      return "直接解析 - 适合小文件";
    } else if (fileSizeKB < 1024) {
      return "流式解析 - 平衡性能和内存使用";
    } else {
      return "深度块读取解析 - 适合大文件";
    }
  }
}

// 导出函数供其他模块使用
export { chain, parser, streamObject, streamValues };