import fs from "fs/promises";
import path from "path";
import { request } from "undici";

export default class LargeJSONHandler {
  constructor() {
    this.chunkSize = 500; // 每次处理的字符数，防止超出上下文限制
  }

  /**
   * 下载大型 JSON 文件
   * @param {string} url - 文件URL
   * @param {string} outputPath - 保存路径
   * @returns {Promise<void>}
   */
  async downloadJSON(url, outputPath) {
    try {
      console.log(`开始下载文件: ${url}`);

      const { body } = await request(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      const fileStream = await fs.open(outputPath, "w");

      let totalBytes = 0;
      for await (const chunk of body) {
        await fileStream.write(chunk);
        totalBytes += chunk.length;
        console.log(`已下载: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
      }

      await fileStream.close();
      console.log(`下载完成，文件保存在: ${outputPath}`);
      console.log(`总大小: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
    } catch (error) {
      console.error("下载失败:", error);
      throw error;
    }
  }

  /**
   * 分块读取 JSON 文件
   * @param {string} filePath - 文件路径
   * @param {object} options - 配置选项
   * @param {number} [options.chunkSize=500] - 每次读取的字符数
   * @param {boolean} [options.pretty=false] - 是否美化输出
   * @param {function} [options.progressCallback] - 进度回调函数
   * @returns {Promise<Generator>}
   */
  async *readJSONInChunks(filePath, options = {}) {
    const {
      chunkSize = this.chunkSize,
      pretty = false,
      progressCallback = null,
    } = options;

    try {
      console.log(`开始读取文件: ${filePath}`);
      const content = await fs.readFile(filePath, "utf8");
      const totalLength = content.length;
      let position = 0;

      while (position < totalLength) {
        const endPosition = Math.min(position + chunkSize, totalLength);
        let chunk = content.slice(position, endPosition);

        // 如果是 JSON 格式，尝试获取完整的 JSON 片段
        try {
          const startIndex = this.findPreviousBracket(content, position);
          const endIndex = this.findNextBracket(content, endPosition);

          if (startIndex !== -1 && endIndex !== -1) {
            chunk = content.slice(startIndex, endIndex);
            const isValidJSON = this.validateJSONSnippet(chunk);

            if (isValidJSON) {
              if (pretty) {
                chunk = this.formatJSONChunk(chunk);
              }

              position = endIndex;

              if (progressCallback) {
                progressCallback(position, totalLength);
              }

              yield {
                chunk,
                position: startIndex,
                progress: Math.round((position / totalLength) * 100),
              };
              continue;
            }
          }
        } catch (error) {
          // 如果解析失败，继续使用原始块
        }

        position += chunkSize;

        if (progressCallback) {
          progressCallback(position, totalLength);
        }

        yield {
          chunk,
          position,
          progress: Math.round((position / totalLength) * 100),
        };
      }

      console.log("文件读取完成");
    } catch (error) {
      console.error("读取文件失败:", error);
      throw error;
    }
  }

  /**
   * 分块写入 JSON 文件
   * @param {string} filePath - 文件路径
   * @param {object} data - 要写入的数据
   * @param {object} options - 配置选项
   * @param {boolean} [options.append=false] - 是否追加到现有文件
   * @param {number} [options.chunkSize=500] - 每次写入的字符数
   * @param {boolean} [options.pretty=false] - 是否美化输出
   * @returns {Promise<void>}
   */
  async writeJSONInChunks(filePath, data, options = {}) {
    const {
      append = false,
      chunkSize = this.chunkSize,
      pretty = false,
    } = options;

    try {
      console.log(`开始写入文件: ${filePath}`);

      let jsonString = JSON.stringify(data);
      if (pretty) {
        jsonString = JSON.stringify(data, null, 2);
      }

      const flag = append ? "a" : "w";
      const fileHandle = await fs.open(filePath, flag);
      const totalLength = jsonString.length;
      let position = 0;

      while (position < totalLength) {
        const endPosition = Math.min(position + chunkSize, totalLength);
        const chunk = jsonString.slice(position, endPosition);

        await fileHandle.write(chunk);
        position = endPosition;

        const progress = Math.round((position / totalLength) * 100);
        console.log(
          `写入进度: ${progress}% (${
            (position / 1024 / 1024).toFixed(
              2,
            )
          } MB / ${(totalLength / 1024 / 1024).toFixed(2)} MB)`,
        );

        // 添加延迟，避免过快的写入
        await new Promise((resolve) => setTimeout(resolve, 1));
      }

      await fileHandle.close();
      console.log("文件写入完成");
    } catch (error) {
      console.error("写入文件失败:", error);
      throw error;
    }
  }

  /**
   * 查找前一个完整的 JSON 括号位置
   */
  findPreviousBracket(content, position) {
    let depth = 0;
    let start = -1;

    for (let i = position; i >= 0; i--) {
      const char = content[i];
      if (char === "{" || char === "[") {
        if (depth === 0) {
          start = i;
          break;
        }
        depth--;
      } else if (char === "}" || char === "]") {
        depth++;
      }
    }

    return start;
  }

  /**
   * 查找下一个完整的 JSON 括号位置
   */
  findNextBracket(content, position) {
    let depth = 0;
    let end = -1;

    for (let i = position; i < content.length; i++) {
      const char = content[i];
      if (char === "{" || char === "[") {
        depth++;
      } else if (char === "}" || char === "]") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }

    return end;
  }

  /**
   * 验证 JSON 片段是否有效
   */
  validateJSONSnippet(snippet) {
    try {
      JSON.parse(snippet);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 格式化 JSON 块
   */
  formatJSONChunk(chunk) {
    try {
      const parsed = JSON.parse(chunk);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return chunk;
    }
  }

  /**
   * 获取文件大小
   */
  async getFileSize(filePath) {
    const stats = await fs.stat(filePath);
    return stats.size;
  }
}

// 如果直接运行此文件，执行示例
if (import.meta.main) {
  const jsonHandler = new LargeJSONHandler();

  // 示例：下载文件
  async function example() {
    try {
      // 下载文件
      await jsonHandler.downloadJSON(
        "http://localhost:8000/openapi.json",
        "./openapi.json",
      );

      // 读取文件（示例）
      console.log("\n开始分块读取文件:");
      for await (
        const {
          chunk,
          position,
          progress,
        } of jsonHandler.readJSONInChunks("./openapi.json", {
          chunkSize: 500,
          pretty: true,
          progressCallback: (pos, total) => {
            console.log(`读取进度: ${Math.round((pos / total) * 100)}%`);
          },
        })
      ) {
        console.log(
          `\n--- 块 ${progress}% (${position}-${position + chunk.length}) ---`,
        );
        console.log(chunk);

        // 在这里可以处理每个块
        break; // 只显示第一个块作为示例
      }
    } catch (error) {
      console.error("示例执行失败:", error);
    }
  }

  // 运行示例
  example();
}
