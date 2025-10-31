import fs from "fs";

// 使用动态导入来处理CommonJS模块
let streamChain, streamJson, streamValues;

try {
  streamChain = await import('stream-chain');
  streamJson = await import('stream-json');
  streamValues = (await import('stream-json/streamers/StreamValues.js')).default ||
                 (await import('stream-json/streamers/StreamValues.js'));

} catch (error) {
  console.error('导入模块失败:', error);
  process.exit(1);
}

const { chain } = streamChain;
const { parser } = streamJson;

export default class StreamJSONParser {
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
      },
      paths: [],
      deepPaths: []
    };
  }

  /**
   * 使用stream-json库进行流式解析
   */
  async parseWithStreamJSON(filePath, options = {}) {
    const {
      chunkSize = 1024 * 20, // 20KB chunks
      maxPaths = 1000,
      progressCallback = null
    } = options;

    console.log(`开始stream-json流式解析: ${filePath}`);
    console.log(`块大小: ${chunkSize} bytes`);

    return new Promise((resolve, reject) => {
      const stats = fs.statSync(filePath);
      const totalSize = stats.size;
      let processedSize = 0;
      let objectCount = 0;

      // 创建流式JSON解析管道
      const pipeline = chain([
        fs.createReadStream(filePath, { highWaterMark: chunkSize }),
        parser(),
        streamValues() // 流式输出值
      ]);

      const topLevelKeys = new Set();
      const structure = {};
      let maxDepth = 0;

      pipeline.on('data', (data) => {
        processedSize += JSON.stringify(data).length;
        objectCount++;

        // 更新进度
        if (progressCallback && objectCount % 100 === 0) {
          const progress = ((processedSize / totalSize) * 100).toFixed(1);
          progressCallback(processedSize, totalSize, progress);
        }

        // 如果数据是顶层对象的属性
        if (data && data.key && data.value !== undefined) {
          topLevelKeys.add(data.key);
          this.analyzeValue(data.key, data.value, structure, 0, maxDepth);
        }
      });

      pipeline.on('end', () => {
        console.log(`✅ stream-json解析完成! 处理了 ${objectCount} 个值`);
        console.log(`🔑 发现顶层键: ${topLevelKeys.size}`);

        const result = {
          success: true,
          method: "stream-json流式解析",
          topLevelKeys: Array.from(topLevelKeys),
          structure: structure,
          stats: {
            fileSizeKB: (totalSize / 1024).toFixed(2),
            topLevelKeyCount: topLevelKeys.size,
            totalElements: objectCount,
            maxDepth: maxDepth,
            typeDistribution: { ...this.results.typeCounts }
          },
          complexity: {
            depth: maxDepth,
            breadth: topLevelKeys.size,
            density: (this.results.typeCounts.objects + this.results.typeCounts.arrays) / (totalSize / 1024)
          }
        };

        resolve(result);
      });

      pipeline.on('error', (error) => {
        console.error('❌ stream-json解析错误:', error);
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
   * 解析数组结构（针对items数组）
   */
  async parseArrayContent(filePath, options = {}) {
    const {
      targetArray = 'items', // 目标数组名称
      maxElements = 1000,
      progressCallback = null
    } = options;

    console.log(`开始数组内容解析: ${filePath} -> ${targetArray}`);

    try {
      const stats = fs.statSync(filePath);
      const totalSize = stats.size;

      return new Promise((resolve, reject) => {
        // 创建流式管道来解析数组元素
        const pipeline = chain([
          fs.createReadStream(filePath),
          parser(),
          streamValues()
        ]);

        const arrayElements = [];
        let elementCount = 0;
        let processedSize = 0;

        pipeline.on('data', (data) => {
          processedSize += JSON.stringify(data).length;
          elementCount++;

          // 查找目标数组的元素
          if (data && data.key === targetArray && Array.isArray(data.value)) {
            // 处理数组元素（限制数量）
            data.value.slice(0, maxElements).forEach((element, index) => {
              arrayElements.push({
                index: index,
                data: element,
                type: this.getElementType(element)
              });

              // 分析元素类型
              this.analyzeValue(`${targetArray}[${index}]`, element, {}, 0, 0);
            });
          }

          if (progressCallback && elementCount % 50 === 0) {
            const progress = ((processedSize / totalSize) * 100).toFixed(1);
            progressCallback(processedSize, totalSize, progress);
          }
        });

        pipeline.on('end', () => {
          console.log(`✅ 数组解析完成! 处理了 ${arrayElements.length} 个元素`);

          resolve({
            success: true,
            method: "数组内容流式解析",
            targetArray: targetArray,
            elements: arrayElements,
            stats: {
              fileSizeKB: (totalSize / 1024).toFixed(2),
              totalElements: arrayElements.length,
              elementTypes: this.getElementTypeStats(arrayElements)
            }
          });
        });

        pipeline.on('error', reject);
      });

    } catch (error) {
      return {
        success: false,
        method: "数组内容流式解析",
        error: error.message
      };
    }
  }

  /**
   * 深度路径解析 - 使用Pick过滤器
   */
  async parseDeepPaths(filePath, options = {}) {
    const {
      targetPaths = [], // 目标路径数组，如 ['info.title', 'paths.*', 'components.*']
      maxDepth = 5,
      maxResults = 500
    } = options;

    console.log(`开始深度路径解析: ${filePath}`);

    try {
      const { chain } = await import('stream-chain');
      const { pick } = await import('stream-json/filters/Pick');

      const stats = fs.statSync(filePath);
      const totalSize = stats.size;

      return new Promise((resolve, reject) => {
        // 创建带有Pick过滤器的管道
        const pipeline = chain([
          fs.createReadStream(filePath),
          parser(),
          pick({ filter: targetPaths }), // 选择特定路径
          streamValues()
        ]);

        const deepPaths = [];
        let pathCount = 0;

        pipeline.on('data', (data) => {
          pathCount++;

          if (data && data.key && data.value !== undefined) {
            deepPaths.push({
              path: data.key,
              value: this.getValuePreview(data.value),
              depth: this.calculatePathDepth(data.key),
              type: typeof data.value
            });
          }

          // 限制结果数量
          if (deepPaths.length >= maxResults) {
            pipeline.destroy();
            console.log(`达到最大结果数量 (${maxResults}), 停止解析`);
          }
        });

        pipeline.on('end', () => {
          console.log(`✅ 深度路径解析完成! 发现 ${deepPaths.length} 个路径`);

          resolve({
            success: true,
            method: "深度路径流式解析",
            deepPaths: deepPaths,
            stats: {
              fileSizeKB: (totalSize / 1024).toFixed(2),
              totalPaths: deepPaths.length,
              maxDepthFound: Math.max(...deepPaths.map(p => p.depth)),
              targetPaths: targetPaths.length
            }
          });
        });

        pipeline.on('error', reject);
      });

    } catch (error) {
      console.error('深度路径解析失败:', error);
      return {
        success: false,
        method: "深度路径流式解析",
        error: error.message
      };
    }
  }

  /**
   * 分析值并更新统计
   */
  analyzeValue(path, value, structure, currentDepth, maxDepth) {
    if (currentDepth > maxDepth) {
      maxDepth = currentDepth;
    }

    const simplePath = path.split('.')[0]; // 只取顶层路径

    if (!structure[simplePath]) {
      structure[simplePath] = this.getTypeInfo(value);
    }

    // 更新类型统计
    if (value === null) {
      this.results.typeCounts.nulls++;
    } else if (typeof value === 'string') {
      this.results.typeCounts.strings++;
    } else if (typeof value === 'number') {
      this.results.typeCounts.numbers++;
    } else if (typeof value === 'boolean') {
      this.results.typeCounts.booleans++;
    } else if (Array.isArray(value)) {
      this.results.typeCounts.arrays++;
    } else if (typeof value === 'object') {
      this.results.typeCounts.objects++;
    }

    this.results.totalElements++;
  }

  /**
   * 获取类型信息
   */
  getTypeInfo(value) {
    if (value === null) return { type: 'null' };
    if (typeof value === 'string') return {
      type: 'string',
      length: value.length,
      sample: value.substring(0, 50) + (value.length > 50 ? '...' : '')
    };
    if (typeof value === 'number') return { type: 'number' };
    if (typeof value === 'boolean') return { type: 'boolean' };
    if (Array.isArray(value)) {
      return {
        type: 'array',
        length: value.length,
        elementTypes: this.getElementTypes(value)
      };
    }
    if (typeof value === 'object') {
      return {
        type: 'object',
        properties: Object.keys(value).slice(0, 10),
        propertyCount: Object.keys(value).length
      };
    }
    return { type: 'unknown' };
  }

  /**
   * 获取元素类型统计
   */
  getElementTypes(array) {
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
   * 获取元素的类型
   */
  getElementType(element) {
    if (element === null) return 'null';
    if (Array.isArray(element)) return 'array';
    return typeof element;
  }

  /**
   * 获取元素类型统计
   */
  getElementTypeStats(elements) {
    const types = {};
    elements.forEach(element => {
      const type = element.type;
      types[type] = (types[type] || 0) + 1;
    });
    return types;
  }

  /**
   * 获取值的预览
   */
  getValuePreview(value) {
    if (value === null) return 'null';
    if (typeof value === 'string') return value.substring(0, 50) + (value.length > 50 ? '...' : '');
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return `Array(${value.length})`;
    if (typeof value === 'object') return `Object{${Object.keys(value).length}}`;
    return value;
  }

  /**
   * 计算路径深度
   */
  calculatePathDepth(path) {
    return (path.match(/\./g) || []).length + (path.match(/\[\d+\]/g) || []).length;
  }

  /**
   * 智能解析 - 根据文件大小自动选择方法
   */
  async smartParse(filePath, options = {}) {
    const {
      chunkSize = 1024 * 20,
      targetArray = 'items',
      targetPaths = [],
      enableDeepAnalysis = true
    } = options;

    try {
      const stats = fs.statSync(filePath);
      const fileSizeKB = stats.size / 1024;

      console.log(`🔍 开始智能JSON解析: ${filePath} (${fileSizeKB.toFixed(2)} KB)`);

      let results = {};

      // 1. 基础流式解析
      console.log('📂 执行基础流式解析...');
      results.basic = await this.parseWithStreamJSON(filePath, {
        chunkSize,
        progressCallback: (processed, total, progress) => {
          console.log(`基础解析进度: ${progress}%`);
        }
      });

      // 2. 数组内容解析（如果适用）
      if (targetArray && results.basic.success) {
        console.log('📋 执行数组内容解析...');
        results.array = await this.parseArrayContent(filePath, {
          targetArray,
          maxElements: 100,
          progressCallback: (processed, total, progress) => {
            console.log(`数组解析进度: ${progress}%`);
          }
        });
      }

      // 3. 深度路径解析（如果启用）
      if (enableDeepAnalysis && results.basic.success && targetPaths.length > 0) {
        console.log('🔍 执行深度路径解析...');
        results.deepPaths = await this.parseDeepPaths(filePath, {
          targetPaths: targetPaths.length > 0 ? targetPaths : results.basic.topLevelKeys.slice(0, 10),
          maxDepth: 5
        });
      }

      return {
        success: true,
        method: "智能流式解析",
        fileSizeKB: fileSizeKB.toFixed(2),
        results: results,
        summary: {
          basicSuccess: results.basic.success,
          arraySuccess: results.array?.success || false,
          deepPathsSuccess: results.deepPaths?.success || false,
          recommendedMethod: this.recommendMethod(fileSizeKB)
        },
        parseTime: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ 智能解析失败:', error);
      return {
        success: false,
        method: "智能流式解析",
        error: error.message
      };
    }
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
      return "深度流式解析 - 适合大文件和深层结构分析";
    }
  }
}