import LargeJSONHandler from './index.js';

class StreamingJSONParser {
    constructor(options = {}) {
        this.maxChunkSize = options.maxChunkSize || 10000;
        this.jsonHandler = new LargeJSONHandler();
    }

    /**
     * 流式解析 JSON 文件并提取指定路径的数据
     */
    async extractPath(filePath, targetPath) {
        console.log(`提取路径: ${targetPath}`);

        const pathStack = this.parsePath(targetPath);
        let buffer = '';
        let currentState = null;

        for await (const { chunk } of this.jsonHandler.readJSONInChunks(filePath, {
            chunkSize: this.maxChunkSize
        })) {
            buffer += chunk;

            try {
                const result = this.parseChunk(buffer, pathStack);
                if (result.found) {
                    return result.data;
                }
            } catch (error) {
                // 继续读取更多数据
                continue;
            }

            // 防止缓冲区过大
            if (buffer.length > 50000) {
                buffer = buffer.slice(-20000);
            }
        }

        throw new Error(`路径未找到: ${targetPath}`);
    }

    /**
     * 解析路径字符串
     */
    parsePath(path) {
        const stack = [];
        const parts = path.split('.');

        for (const part of parts) {
            // 处理数组索引 path[0] 或 path[1].item[2]
            const arrayMatch = part.match(/([^\[]+)(?:\[(\d+)\])?/);
            if (arrayMatch) {
                const [_, key, index] = arrayMatch;
                if (index !== undefined) {
                    stack.push({ type: 'key', value: key });
                    stack.push({ type: 'index', value: parseInt(index) });
                } else {
                    stack.push({ type: 'key', value: key });
                }
            } else if (part.match(/^\d+$/)) {
                // 纯数字索引
                stack.push({ type: 'index', value: parseInt(part) });
            }
        }

        return stack;
    }

    /**
     * 解析数据块
     */
    parseChunk(chunk, pathStack) {
        let braceLevel = 0;
        let bracketLevel = 0;
        let inString = false;
        let escapeNext = false;
        let currentPath = [];

        for (let i = 0; i < chunk.length; i++) {
            const char = chunk[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\' && inString) {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{') {
                    braceLevel++;
                    // 开始一个新对象
                    const key = this.parseKey(chunk, i);
                    if (key) {
                        currentPath.push(key);
                        if (this.pathMatches(currentPath, pathStack)) {
                            // 找到目标路径
                            return {
                                found: true,
                                data: this.extractValue(chunk, i)
                            };
                        }
                    }
                } else if (char === '}') {
                    braceLevel--;
                    if (currentPath.length > 0) {
                        currentPath.pop();
                    }
                } else if (char === '[') {
                    bracketLevel++;
                } else if (char === ']') {
                    bracketLevel--;
                }
            }
        }

        return { found: false };
    }

    /**
     * 解析键名
     */
    parseKey(chunk, position) {
        // 向后查找键名
        let keyStart = -1;
        let keyEnd = -1;

        for (let i = position - 1; i >= 0; i--) {
            if (chunk[i] === '"' && (i === 0 || chunk[i - 1] !== '\\')) {
                if (keyEnd === -1) {
                    keyEnd = i;
                } else {
                    keyStart = i + 1;
                    break;
                }
            }
        }

        if (keyStart !== -1 && keyEnd !== -1) {
            return chunk.slice(keyStart, keyEnd);
        }

        return null;
    }

    /**
     * 检查路径是否匹配
     */
    pathMatches(currentPath, targetPath) {
        if (currentPath.length < targetPath.length) {
            return false;
        }

        for (let i = 0; i < targetPath.length; i++) {
            if (currentPath[i] !== targetPath[i].value) {
                return false;
            }
        }

        return currentPath.length === targetPath.length;
    }

    /**
     * 提取值
     */
    extractValue(chunk, position) {
        // 简化的值提取，实际应该更复杂
        let value = '';
        let braceLevel = 0;
        let bracketLevel = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = position; i < chunk.length; i++) {
            const char = chunk[i];

            if (escapeNext) {
                value += char;
                escapeNext = false;
                continue;
            }

            if (char === '\\' && inString) {
                escapeNext = true;
                value += char;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                value += char;
                continue;
            }

            if (!inString) {
                if (char === '{') {
                    braceLevel++;
                    value += char;
                } else if (char === '}') {
                    braceLevel--;
                    value += char;
                    if (braceLevel === 0) {
                        break;
                    }
                } else if (char === '[') {
                    bracketLevel++;
                    value += char;
                } else if (char === ']') {
                    bracketLevel--;
                    value += char;
                    if (bracketLevel === 0) {
                        break;
                    }
                } else if (char === ',' && braceLevel === 0 && bracketLevel === 0) {
                    break;
                } else {
                    value += char;
                }
            } else {
                value += char;
            }
        }

        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    /**
     * 获取 JSON 文件的基本结构
     */
    async getBasicStructure(filePath) {
        console.log('获取基本结构...');

        const structure = {
            type: 'unknown',
            size: 0,
            topLevelKeys: [],
            arrayCount: 0,
            objectCount: 0
        };

        let buffer = '';
        let braceCount = 0;
        let bracketCount = 0;
        let inString = false;
        let escapeNext = false;

        for await (const { chunk } of this.jsonHandler.readJSONInChunks(filePath, {
            chunkSize: this.maxChunkSize
        })) {
            buffer += chunk;

            // 统计基本结构
            for (let i = 0; i < buffer.length; i++) {
                const char = buffer[i];

                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }

                if (char === '\\' && inString) {
                    escapeNext = true;
                    continue;
                }

                if (char === '"') {
                    inString = !inString;
                    continue;
                }

                if (!inString) {
                    if (char === '{') {
                        structure.objectCount++;
                        if (structure.objectCount === 1) {
                            // 根对象
                            structure.type = 'object';
                        }
                    } else if (char === '}') {
                        structure.objectCount--;
                    } else if (char === '[') {
                        structure.arrayCount++;
                        if (structure.arrayCount === 1 && structure.type === 'unknown') {
                            structure.type = 'array';
                        }
                    } else if (char === ']') {
                        structure.arrayCount--;
                    }
                }
            }

            // 尝试提取顶级键
            if (structure.type === 'object' && structure.topLevelKeys.length === 0) {
                const keys = this.extractTopLevelKeys(buffer);
                if (keys.length > 0) {
                    structure.topLevelKeys = keys;
                }
            }

            // 如果缓冲区过大，清理
            if (buffer.length > 20000) {
                buffer = buffer.slice(-5000);
            }

            // 如果已经收集到足够信息，退出
            if (structure.topLevelKeys.length > 0 || structure.objectCount > 100) {
                break;
            }
        }

        return structure;
    }

    /**
     * 提取顶级键
     */
    extractTopLevelKeys(chunk) {
        const keys = [];
        const regex = /"([^"]+)":/g;
        let match;

        while ((match = regex.exec(chunk)) !== null) {
            keys.push(match[1]);
            if (keys.length >= 20) break; // 限制键的数量
        }

        return keys;
    }

    /**
     * 获取 JSON 路径下的数据类型信息
     */
    async getPathInfo(filePath, targetPath) {
        try {
            const structure = await this.getBasicStructure(filePath);

            if (targetPath === '' || targetPath === '/') {
                return structure;
            }

            // 如果有目标路径，尝试获取具体信息
            try {
                const value = await this.extractPath(filePath, targetPath);
                return {
                    type: Array.isArray(value) ? 'array' :
                          typeof value === 'object' && value !== null ? 'object' :
                          typeof value,
                    value: typeof value === 'object' ? '[Object]' : String(value),
                    size: JSON.stringify(value).length
                };
            } catch (error) {
                return {
                    type: 'unknown',
                    error: error.message
                };
            }
        } catch (error) {
            return {
                type: 'error',
                error: error.message
            };
        }
    }
}

export default StreamingJSONParser;