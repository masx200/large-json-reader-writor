import LargeJSONHandler from './index.js';
import fs from 'fs/promises';

class JSONStructureBrowser {
    constructor(options = {}) {
        this.maxDisplayLength = options.maxDisplayLength || 300;
        this.maxArrayItems = options.maxArrayItems || 5;
        this.maxObjectKeys = options.maxObjectKeys || 5;
        this.jsonHandler = new LargeJSONHandler();
    }

    /**
     * 分析 JSON 文件结构
     * @param {string} filePath - 文件路径
     * @returns {Promise<object>} - 结构信息
     */
    async analyzeStructure(filePath) {
        console.log(`开始分析 JSON 文件结构: ${filePath}`);

        const structure = {
            type: 'root',
            path: '',
            size: 0,
            children: [],
            summary: {}
        };

        try {
            // 获取文件大小
            const stats = await fs.stat(filePath);
            structure.size = stats.size;

            // 分块读取并解析结构
            let buffer = '';
            let braceCount = 0;
            let bracketCount = 0;
            let inString = false;
            let escapeNext = false;

            for await (const { chunk } of this.jsonHandler.readJSONInChunks(filePath, {
                chunkSize: 1000,
                pretty: true
            })) {
                buffer += chunk;

                // 解析结构
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
                            braceCount++;
                        } else if (char === '}') {
                            braceCount--;
                        } else if (char === '[') {
                            bracketCount++;
                        } else if (char === ']') {
                            bracketCount--;
                        }
                    }
                }

                // 如果缓冲区太大，处理已收集的数据
                if (buffer.length > 5000) {
                    const partialStructure = this.parseStructure(buffer, structure);
                    if (partialStructure) {
                        structure.children = partialStructure.children;
                        structure.summary = partialStructure.summary;
                    }
                    buffer = buffer.slice(-1000); // 保留部分内容用于继续解析
                }

                // 如果 JSON 解析完成，退出循环
                if (braceCount === 0 && bracketCount === 0 && buffer.trim().length > 0) {
                    break;
                }
            }

            // 处理剩余的缓冲区
            if (buffer.length > 0) {
                const finalStructure = this.parseStructure(buffer, structure);
                if (finalStructure) {
                    structure.children = finalStructure.children;
                    structure.summary = finalStructure.summary;
                }
            }

            console.log(`结构分析完成`);
            return structure;

        } catch (error) {
            console.error('结构分析失败:', error);
            throw error;
        }
    }

    /**
     * 解析 JSON 结构片段
     */
    parseStructure(jsonString, parentStructure) {
        try {
            const data = JSON.parse(jsonString);
            return this.buildStructure(data, parentStructure.path);
        } catch (error) {
            // 如果解析失败，返回部分结构
            return this.buildPartialStructure(jsonString);
        }
    }

    /**
     * 构建完整结构
     */
    buildStructure(data, path = '') {
        const structure = {
            type: typeof data,
            path: path,
            children: [],
            summary: {}
        };

        if (data === null) {
            structure.type = 'null';
            structure.summary.value = null;
        } else if (typeof data === 'object') {
            if (Array.isArray(data)) {
                structure.type = 'array';
                structure.summary.length = data.length;
                structure.summary.type = this.getArrayItemType(data);

                // 添加前几项作为示例
                data.slice(0, this.maxArrayItems).forEach((item, index) => {
                    const itemPath = path ? `${path}[${index}]` : `[${index}]`;
                    const itemStructure = this.buildStructure(item, itemPath);
                    structure.children.push(itemStructure);
                });

                // 如果数组很大，添加省略标记
                if (data.length > this.maxArrayItems) {
                    structure.children.push({
                        type: 'ellipsis',
                        path: `${path}[${this.maxArrayItems}...${data.length - 1}]`,
                        summary: { omitted: data.length - this.maxArrayItems }
                    });
                }
            } else {
                structure.type = 'object';
                structure.summary.keys = Object.keys(data);
                structure.summary.keyCount = Object.keys(data).length;

                // 添加前几个键值对作为示例
                Object.entries(data).slice(0, this.maxObjectKeys).forEach(([key, value]) => {
                    const itemPath = path ? `${path}.${key}` : key;
                    const itemStructure = this.buildStructure(value, itemPath);
                    itemStructure.summary.key = key;
                    structure.children.push(itemStructure);
                });

                // 如果对象键很多，添加省略标记
                if (Object.keys(data).length > this.maxObjectKeys) {
                    structure.children.push({
                        type: 'ellipsis',
                        path: `${path}...`,
                        summary: { omitted: Object.keys(data).length - this.maxObjectKeys }
                    });
                }
            }
        } else {
            structure.summary.value = data;
            structure.summary.display = this.truncateValue(data);
        }

        return structure;
    }

    /**
     * 构建部分结构（用于解析失败时）
     */
    buildPartialStructure(jsonString) {
        const structure = {
            type: 'partial',
            path: '',
            children: [],
            summary: {}
        };

        // 尝试提取一些关键信息
        const paths = this.extractPaths(jsonString);
        structure.summary.paths = paths.slice(0, 10);
        structure.summary.estimatedKeys = this.estimateKeys(jsonString);
        structure.summary.containsArray = jsonString.includes('[');
        structure.summary.containsObject = jsonString.includes('{');

        return structure;
    }

    /**
     * 提取 JSON 路径
     */
    extractPaths(jsonString) {
        const paths = [];
        const stack = [];
        let currentPath = '';
        let inString = false;
        let escapeNext = false;

        for (let i = 0; i < jsonString.length; i++) {
            const char = jsonString[i];

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
                if (char === '{' || char === '[') {
                    stack.push(char);
                    if (paths.length < 20) {
                        paths.push(currentPath);
                    }
                } else if (char === '}' || char === ']') {
                    stack.pop();
                    currentPath = this.getParentPath(currentPath);
                } else if (char === ':') {
                    // 可能是对象的键
                    const keyMatch = jsonString.slice(0, i).match(/"([^"]+)"\s*:$/);
                    if (keyMatch && stack.length > 0) {
                        currentPath = currentPath ? `${currentPath}.${keyMatch[1]}` : keyMatch[1];
                    }
                }
            }
        }

        return paths;
    }

    /**
     * 估计键的数量
     */
    estimateKeys(jsonString) {
        const keyMatches = jsonString.match(/"([^"]+)"\s*:/g);
        return keyMatches ? keyMatches.length : 0;
    }

    /**
     * 获取父路径
     */
    getParentPath(path) {
        const lastDot = path.lastIndexOf('.');
        const lastBracket = path.lastIndexOf('[');
        const cutIndex = Math.max(lastDot, lastBracket);
        return cutIndex > 0 ? path.substring(0, cutIndex) : '';
    }

    /**
     * 获取数组项类型
     */
    getArrayItemType(array) {
        if (array.length === 0) return 'empty';

        const types = array.slice(0, 10).map(item => {
            if (item === null) return 'null';
            if (Array.isArray(item)) return 'array';
            if (typeof item === 'object') return 'object';
            return typeof item;
        });

        const uniqueTypes = [...new Set(types)];
        return uniqueTypes.length === 1 ? uniqueTypes[0] : 'mixed';
    }

    /**
     * 截断值以用于显示
     */
    truncateValue(value) {
        const str = String(value);
        if (str.length <= this.maxDisplayLength) {
            return str;
        }
        return str.substring(0, this.maxDisplayLength - 3) + '...';
    }

    /**
     * 导航到指定路径
     * @param {string} filePath - 文件路径
     * @param {string} path - JSON 路径
     * @returns {Promise<object>} - 指定路径的数据
     */
    async navigateToPath(filePath, path) {
        console.log(`导航到路径: ${path}`);

        try {
            const data = await this.readPartialJSON(filePath, path);
            return this.buildStructure(data, path);
        } catch (error) {
            console.error(`导航失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 读取 JSON 的部分内容
     */
    async readPartialJSON(filePath, targetPath) {
        // 实现读取特定路径的数据
        // 这里使用流式解析
        let buffer = '';
        let inString = false;
        let escapeNext = false;
        let braceCount = 0;
        let bracketCount = 0;

        for await (const { chunk } of this.jsonHandler.readJSONInChunks(filePath, {
            chunkSize: 5000
        })) {
            buffer += chunk;

            // 检查 JSON 是否完整
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
                        braceCount++;
                    } else if (char === '}') {
                        braceCount--;
                    } else if (char === '[') {
                        bracketCount++;
                    } else if (char === ']') {
                        bracketCount--;
                    }
                }
            }

            // 如果 JSON 完整，尝试解析
            if (braceCount === 0 && bracketCount === 0 && buffer.trim().length > 0) {
                try {
                    const data = JSON.parse(buffer);
                    return this.navigateData(data, targetPath);
                } catch (e) {
                    // 如果解析失败，继续读取
                    continue;
                }
            }

            // 如果缓冲区太大，重置
            if (buffer.length > 100000) {
                buffer = '';
            }
        }

        throw new Error('无法解析 JSON 数据');
    }

    /**
     * 在数据中导航到指定路径
     */
    navigateData(data, path) {
        if (!path || path === '') {
            return data;
        }

        const pathParts = path.split('.').map(part => {
            // 处理数组索引 [0]
            const match = part.match(/([^\[]+)(\[(\d+)\])?/);
            if (match) {
                return {
                    key: match[1],
                    index: match[3] ? parseInt(match[3]) : null
                };
            }
            return { key: part, index: null };
        });

        let current = data;

        for (const part of pathParts) {
            if (part.index !== null) {
                // 数组访问
                if (current && Array.isArray(current)) {
                    current = current[part.index];
                } else {
                    return null;
                }
            } else {
                // 对象访问
                if (current && typeof current === 'object' && !Array.isArray(current)) {
                    current = current[part.key];
                } else {
                    return null;
                }
            }
        }

        return current;
    }

    /**
     * 显示结构
     */
    displayStructure(structure, indent = 0) {
        const spaces = ' '.repeat(indent * 2);
        let output = '';

        switch (structure.type) {
            case 'object':
                output += `${spaces}📁 Object (${structure.summary.keyCount} keys)\n`;
                structure.children.forEach(child => {
                    output += this.displayStructure(child, indent + 1);
                });
                break;

            case 'array':
                output += `${spaces}📋 Array (${structure.summary.length} items, type: ${structure.summary.type})\n`;
                structure.children.forEach(child => {
                    output += this.displayStructure(child, indent + 1);
                });
                break;

            case 'string':
                output += `${spaces}📝 String: "${structure.summary.display}"\n`;
                break;

            case 'number':
                output += `${spaces}🔢 Number: ${structure.summary.value}\n`;
                break;

            case 'boolean':
                output += `${spaces}✅ Boolean: ${structure.summary.value}\n`;
                break;

            case 'null':
                output += `${spaces}⚪ Null\n`;
                break;

            case 'ellipsis':
                output += `${spaces}... ${structure.summary.omitted} more items\n`;
                break;

            case 'partial':
                output += `${spaces}📊 Partial structure (estimated keys: ${structure.summary.estimatedKeys})\n`;
                if (structure.summary.paths) {
                    structure.summary.paths.forEach(p => {
                        output += `${spaces}  - ${p}\n`;
                    });
                }
                break;

            default:
                output += `${spaces}${structure.type}: ${JSON.stringify(structure.summary)}\n`;
        }

        return output;
    }

    /**
     * 搜索 JSON 结构
     */
    async search(filePath, searchTerm) {
        console.log(`搜索: "${searchTerm}"`);

        const results = [];
        let buffer = '';

        for await (const { chunk } of this.jsonHandler.readJSONInChunks(filePath, {
            chunkSize: 2000
        })) {
            buffer += chunk;

            // 搜索键
            const keyMatches = [...buffer.matchAll(/"([^"]+)"\s*:/g)];
            for (const match of keyMatches) {
                if (match[1].toLowerCase().includes(searchTerm.toLowerCase())) {
                    results.push({
                        type: 'key',
                        value: match[1],
                        position: match.index
                    });
                }
            }

            // 搜索值
            const valueMatches = [...buffer.matchAll(/:\s*"([^"]*)"/g)];
            for (const match of valueMatches) {
                if (match[1].toLowerCase().includes(searchTerm.toLowerCase())) {
                    results.push({
                        type: 'value',
                        value: match[1],
                        position: match.index
                    });
                }
            }

            // 清理缓冲区，避免过大
            if (buffer.length > 10000) {
                buffer = buffer.slice(-5000);
            }
        }

        return results;
    }
}

export default JSONStructureBrowser;