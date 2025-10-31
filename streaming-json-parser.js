import fs from "fs";

export default class StreamingJSONParser {
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
        nulls: 0,
      },
      deepPaths: [],
    };
  }

  /**
   * 流式解析大型JSON文件
   */
  async parseLargeJSON(filePath, options = {}) {
    const {
      chunkSize = 1024 * 20, // 20KB
      maxDepth = 10,
      progressCallback = null,
      maxSamples = 1000, // 最大采样数量
    } = options;

    console.log(`开始流式解析: ${filePath}`);
    console.log(`块大小: ${chunkSize} bytes, 最大深度: ${maxDepth}`);

    return new Promise((resolve, reject) => {
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // 创建可读流
      const readStream = fs.createReadStream(filePath, {
        highWaterMark: chunkSize,
        encoding: "utf8",
      });

      let buffer = "";
      let braceCount = 0;
      let bracketCount = 0;
      let inString = false;
      let escapeNext = false;
      let processedSize = 0;

      // 收集完整的JSON对象
      const jsonObjects = [];
      let currentObject = "";

      readStream.on("data", (chunk) => {
        processedSize += chunk.length;

        // 更新进度
        if (progressCallback) {
          progressCallback(processedSize, fileSize);
        }

        // 逐字符分析
        for (let i = 0; i < chunk.length; i++) {
          const char = chunk[i];

          if (!inString) {
            if (char === "{" && !escapeNext) {
              if (braceCount === 0 && bracketCount === 0) {
                // 开始新的JSON对象
                currentObject = char;
              }
              braceCount++;
            } else if (char === "}" && !escapeNext) {
              braceCount--;
              if (braceCount === 0 && bracketCount === 0) {
                // 完成一个JSON对象
                currentObject += char;
                if (currentObject.length > 2) { // 排除空对象 {}
                  jsonObjects.push(currentObject);
                }
                currentObject = "";
              } else {
                currentObject += char;
              }
            } else if (char === "[" && !escapeNext) {
              bracketCount++;
              currentObject += char;
            } else if (char === "]" && !escapeNext) {
              bracketCount--;
              currentObject += char;
            } else {
              currentObject += char;
            }

            if (char === '"' && !escapeNext) {
              inString = true;
            }
            escapeNext = false;
          } else {
            if (char === '"' && !escapeNext) {
              inString = false;
            }
            if (char === "\\" && !escapeNext) {
              escapeNext = true;
            } else {
              escapeNext = false;
            }
            currentObject += char;
          }
        }

        // 限制采样数量以避免内存溢出
        if (jsonObjects.length >= maxSamples) {
          readStream.destroy();
          console.log(`达到最大采样数量 (${maxSamples}), 停止读取`);
        }
      });

      readStream.on("end", () => {
        console.log(`文件读取完成，收集到 ${jsonObjects.length} 个JSON对象`);
        this.processJSONObjects(jsonObjects);
        resolve(this.getResults());
      });

      readStream.on("error", (error) => {
        console.error("流读取错误:", error);
        reject(error);
      });
    });
  }

  /**
   * 处理收集的JSON对象
   */
  processJSONObjects(jsonObjects) {
    const topLevelKeys = new Set();
    const structure = {};

    for (const jsonStr of jsonObjects) {
      try {
        const obj = JSON.parse(jsonStr);
        console.log(`成功解析对象，键数量: ${Object.keys(obj).length}`);

        // 分析顶层结构
        Object.keys(obj).forEach((key) => {
          topLevelKeys.add(key);
          this.analyzeValue(key, obj[key], structure, 0);
        });
      } catch (error) {
        console.log(`解析错误: ${error.message}`);
        // 忽略解析错误，继续处理其他对象
      }
    }

    this.results.topLevelKeys = Array.from(topLevelKeys);
    this.results.structure = structure;
    console.log(`总顶层键数量: ${this.results.topLevelKeys.length}`);
  }

  /**
   * 递归分析值
   */
  analyzeValue(key, value, structure, depth) {
    if (depth > this.results.maxDepth) {
      this.results.maxDepth = depth;
    }

    const path = `${key}`;

    if (!structure[path]) {
      structure[path] = {
        type: "unknown",
        count: 0,
        samples: [],
      };
    }

    structure[path].count++;

    if (value === null) {
      structure[path].type = "null";
      this.results.typeCounts.nulls++;
      this.results.totalElements++;
    } else if (typeof value === "string") {
      structure[path].type = "string";
      if (structure[path].samples.length < 5) {
        structure[path].samples.push(value.substring(0, 50));
      }
      this.results.typeCounts.strings++;
      this.results.totalElements++;
    } else if (typeof value === "number") {
      structure[path].type = "number";
      this.results.typeCounts.numbers++;
      this.results.totalElements++;
    } else if (typeof value === "boolean") {
      structure[path].type = "boolean";
      this.results.typeCounts.booleans++;
      this.results.totalElements++;
    } else if (Array.isArray(value)) {
      structure[path].type = "array";
      structure[path].length = value.length;
      this.results.typeCounts.arrays++;
      this.results.totalElements++;

      // 分析数组元素
      if (depth < 5) { // 限制递归深度
        value.forEach((item, index) => {
          this.analyzeValue(`${key}[${index}]`, item, structure, depth + 1);
        });
      }
    } else if (typeof value === "object") {
      structure[path].type = "object";
      const keys = Object.keys(value);
      structure[path].properties = keys.slice(0, 10); // 只保存前10个属性
      structure[path].propertyCount = keys.length;
      this.results.typeCounts.objects++;
      this.results.totalElements++;

      // 递归分析子对象
      if (depth < 5) { // 限制递归深度
        keys.forEach((subKey) => {
          this.analyzeValue(
            `${key}.${subKey}`,
            value[subKey],
            structure,
            depth + 1,
          );
        });
      }
    }
  }

  /**
   * 深度解析 - 使用分块方法解析深层结构
   */
  async deepParse(filePath, options = {}) {
    const {
      chunkSize = 1024 * 20, // 20KB
      maxDepth = 5,
      targetPaths = [], // 指定要提取的路径
      useSampling = true, // 是否使用采样
    } = options;

    console.log(`开始深度解析: ${filePath}`);
    console.log(`目标深度: ${maxDepth}, 块大小: ${chunkSize}`);

    try {
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // 读取整个文件（对于非常大的文件，这可能需要优化）
      const content = fs.readFileSync(filePath, "utf8");

      // 提取深层路径
      const deepResults = this.extractDeepPaths(content, maxDepth, targetPaths);

      return {
        success: true,
        method: "深度解析",
        fileSizeKB: (fileSize / 1024).toFixed(2),
        deepPaths: deepResults.paths,
        structure: deepResults.structure,
        stats: {
          totalPaths: deepResults.paths.length,
          maxDepthFound: deepResults.maxDepth,
          targetPaths: targetPaths.length,
          useSampling: useSampling,
        },
      };
    } catch (error) {
      return {
        success: false,
        method: "深度解析",
        error: error.message,
      };
    }
  }

  /**
   * 提取深层路径
   */
  extractDeepPaths(content, maxDepth, targetPaths = []) {
    const paths = [];
    const structure = {};
    let maxDepthFound = 0;

    try {
      // 尝试解析整个JSON
      const data = JSON.parse(content);

      // 递归提取路径
      const extractPaths = (obj, currentPath = "", depth = 0) => {
        if (depth > maxDepthFound) {
          maxDepthFound = depth;
        }

        if (depth > maxDepth && maxDepth > 0) {
          return;
        }

        if (typeof obj === "object" && obj !== null) {
          Object.keys(obj).forEach((key) => {
            const path = currentPath ? `${currentPath}.${key}` : key;
            paths.push({ path, depth, key });

            // 更新结构信息
            if (!structure[path]) {
              structure[path] = {
                type: typeof obj[key],
                value: this.getValuePreview(obj[key]),
              };
            }

            if (typeof obj[key] === "object" && obj[key] !== null) {
              extractPaths(obj[key], path, depth + 1);
            }
          });
        }
      };

      extractPaths(data);
    } catch (error) {
      // 如果完整解析失败，使用部分解析
      console.log("完整解析失败，使用部分解析方法");
      return this.partialPathExtraction(content, maxDepth);
    }

    return {
      paths: targetPaths.length > 0
        ? paths.filter((p) => targetPaths.includes(p.path))
        : paths,
      structure,
      maxDepthFound,
    };
  }

  /**
   * 部分路径提取
   */
  partialPathExtraction(content, maxDepth) {
    const paths = [];
    const structure = {};
    let maxDepthFound = 0;

    // 使用正则表达式提取JSON路径
    const pathMatch = content.match(/"([^"]+)":/g);

    if (pathMatch) {
      pathMatch.forEach((match) => {
        const key = match.replace(/"/g, "").replace(":", "");
        paths.push({
          path: key,
          depth: 1,
          key: key,
        });
        structure[key] = { type: "unknown", extracted: true };
      });
      maxDepthFound = 1;
    }

    return {
      paths,
      structure,
      maxDepthFound,
    };
  }

  /**
   * 获取值的预览
   */
  getValuePreview(value) {
    if (value === null) return "null";
    if (typeof value === "string") {
      return value.substring(0, 50) + (value.length > 50 ? "..." : "");
    }
    if (typeof value === "number") return value;
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) return `Array(${value.length})`;
    if (typeof value === "object") {
      return `Object{${Object.keys(value).length}}`;
    }
    return value;
  }

  /**
   * 获取结果
   */
  getResults() {
    return {
      success: true,
      method: "流式JSON解析",
      topLevelKeys: this.results.topLevelKeys,
      structure: this.results.structure,
      stats: {
        topLevelKeyCount: this.results.topLevelKeys.length,
        maxDepth: this.results.maxDepth,
        totalElements: this.results.totalElements,
        typeDistribution: { ...this.results.typeCounts },
      },
      complexity: {
        depth: this.results.maxDepth,
        breadth: this.results.topLevelKeys.length,
        density:
          (this.results.typeCounts.objects + this.results.typeCounts.arrays) /
          1, // 简化计算
      },
    };
  }

  /**
   * 智能解析 - 自动选择最佳方法
   */
  async smartParse(filePath, options = {}) {
    const stats = fs.statSync(filePath);
    const fileSizeKB = stats.size / 1024;

    console.log(`智能解析开始: ${filePath} (${fileSizeKB.toFixed(2)} KB)`);

    let result;

    if (fileSizeKB < 100) {
      // 小文件：直接解析
      console.log("使用直接解析方法");
      result = await this.directParse(filePath);
    } else if (fileSizeKB < 1024) {
      // 中等文件：流式解析
      console.log("使用流式解析方法");
      result = await this.parseLargeJSON(filePath, options);
    } else {
      // 大文件：深度解析
      console.log("使用深度解析方法");
      result = await this.deepParse(filePath, options);
    }

    return {
      ...result,
      fileSizeKB: fileSizeKB.toFixed(2),
      recommendedMethod: this.recommendMethod(fileSizeKB),
      parseTime: new Date().toISOString(),
    };
  }

  /**
   * 直接解析（小文件）
   */
  async directParse(filePath) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(content);

      this.results.topLevelKeys = Object.keys(data);
      this.results.maxDepth = this.calculateMaxDepth(data);

      // 简单结构分析
      Object.keys(data).forEach((key) => {
        this.analyzeValue(key, data[key], this.results.structure, 0);
      });

      return this.getResults();
    } catch (error) {
      return {
        success: false,
        method: "直接解析",
        error: error.message,
      };
    }
  }

  /**
   * 计算最大深度
   */
  calculateMaxDepth(obj, currentDepth = 0) {
    if (typeof obj !== "object" || obj === null) {
      return currentDepth;
    }

    let maxDepth = currentDepth;
    Object.values(obj).forEach((value) => {
      if (typeof value === "object" && value !== null) {
        const depth = this.calculateMaxDepth(value, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    });

    return maxDepth;
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
      return "深度解析 - 适合大文件";
    }
  }
}
