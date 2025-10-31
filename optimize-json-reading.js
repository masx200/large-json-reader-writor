#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import LargeJSONHandler from './index.js';
import JSONStructureBrowser from './json-browser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 查找文件夹中最大的两个JSON文件
 * @param {string} directory - 要搜索的目录
 * @returns {Array<{filename: string, size: number, path: string}>} - 最大的两个文件信息
 */
async function findLargestJSONFiles(directory) {
    console.log('🔍 搜索最大的JSON文件...\n');

    const files = await fs.promises.readdir(directory);
    const jsonFiles = [];

    for (const file of files) {
        if (file.endsWith('.json') && file !== 'package.json' && file !== 'package-lock.json') {
            const filePath = path.join(directory, file);
            const stats = await fs.promises.stat(filePath);
            jsonFiles.push({
                filename: file,
                size: stats.size,
                path: filePath,
                sizeMB: (stats.size / (1024 * 1024)).toFixed(2)
            });
        }
    }

    // 按大小排序并取最大的两个
    jsonFiles.sort((a, b) => b.size - a.size);
    const largestFiles = jsonFiles.slice(0, 2);

    console.log(`📁 找到 ${jsonFiles.length} 个JSON文件，最大的两个是：`);
    largestFiles.forEach((file, index) => {
        console.log(`${index + 1}. ${file.filename} (${file.sizeMB} MB)`);
    });

    return largestFiles;
}

/**
 * 方法1：基于文件偏移量的读取
 * @param {string} filePath - JSON文件路径
 * @param {number} chunkSize - 块大小
 */
async function readByFileOffset(filePath, chunkSize = 1000) {
    console.log(`\n📖 方法1：基于文件偏移量读取 - ${path.basename(filePath)}`);
    console.log(`📏 块大小: ${chunkSize} 字节\n`);

    const handler = new LargeJSONHandler();
    const startTime = performance.now();

    try {
        const stats = await fs.promises.stat(filePath);
        const totalSize = stats.size;
        console.log(`📊 文件总大小: ${(totalSize / 1024).toFixed(2)} KB`);

        // 创建可读流
        const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });

        let offset = 0;
        let chunks = [];
        let currentChunk = '';
        let bracketStack = [];
        let jsonObjects = [];
        let objStartPos = -1;

        fileStream.on('data', (chunk) => {
            currentChunk += chunk;

            // 查找完整的JSON对象
            let inString = false;
            let escapeNext = false;

            for (let i = 0; i < currentChunk.length; i++) {
                const char = currentChunk[i];

                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }

                if (char === '\\' && inString) {
                    escapeNext = true;
                    continue;
                }

                if (char === '"' && !escapeNext) {
                    inString = !inString;
                    continue;
                }

                if (inString) continue;

                if (char === '{' || char === '[') {
                    if (bracketStack.length === 0) {
                        // 记录对象的开始位置
                        objStartPos = offset + i;
                    }
                    bracketStack.push(char);
                } else if (char === '}' || char === ']') {
                    if (bracketStack.length > 0) {
                        const lastBracket = bracketStack.pop();
                        if ((char === '}' && lastBracket === '{') ||
                            (char === ']' && lastBracket === '[')) {
                            if (bracketStack.length === 0 && objStartPos >= 0) {
                                // 找到完整的JSON对象
                                const jsonStr = currentChunk.substring(objStartPos - offset, i + 1);
                                try {
                                    const obj = JSON.parse(jsonStr);
                                    jsonObjects.push({
                                        offset: objStartPos,
                                        size: jsonStr.length,
                                        type: Array.isArray(obj) ? 'array' : 'object',
                                        keyCount: typeof obj === 'object' && obj !== null ? Object.keys(obj).length : 0
                                    });
                                    currentChunk = currentChunk.substring(i + 1);
                                    offset = objStartPos + jsonStr.length;
                                    objStartPos = -1;
                                    i = -1; // 重置索引
                                } catch (e) {
                                    // 不是有效的JSON，继续处理
                                    objStartPos = -1;
                                }
                            }
                        }
                    }
                }
            }

            offset += chunk.length;

            // 进度报告
            if (offset % (chunkSize * 10) === 0) {
                const progress = (offset / totalSize * 100).toFixed(1);
                console.log(`⏳ 进度: ${progress}% (${(offset / 1024).toFixed(2)} / ${(totalSize / 1024).toFixed(2)} KB)`);
            }
        });

        return new Promise((resolve) => {
            fileStream.on('end', () => {
                const endTime = performance.now();
                const duration = (endTime - startTime).toFixed(2);

                console.log(`\n✅ 方法1完成！`);
                console.log(`⏱️ 耗时: ${duration}ms`);
                console.log(`📦 找到 ${jsonObjects.length} 个JSON对象`);

                if (jsonObjects.length > 0) {
                    console.log('\n🔍 前5个对象分析:');
                    jsonObjects.slice(0, 5).forEach((obj, index) => {
                        console.log(`  ${index + 1}. 偏移量: ${obj.offset}, 大小: ${obj.size} 字节, 类型: ${obj.type}, 键数量: ${obj.keyCount}`);
                    });
                }

                resolve({
                    method: 'file-offset',
                    duration: parseFloat(duration),
                    objects: jsonObjects,
                    totalSize: totalSize
                });
            });

            fileStream.on('error', (error) => {
                console.error(`❌ 读取文件时出错:`, error.message);
                resolve({
                    method: 'file-offset',
                    duration: 0,
                    objects: [],
                    error: error.message
                });
            });
        });

    } catch (error) {
        console.error(`❌ 方法1执行失败:`, error.message);
        return {
            method: 'file-offset',
            duration: 0,
            objects: [],
            error: error.message
        };
    }
}

/**
 * 方法2：使用JSON解析器解析为JavaScript对象
 * @param {string} filePath - JSON文件路径
 * @param {number} chunkSize - 块大小
 */
async function readWithJSONParser(filePath, chunkSize = 500) {
    console.log(`\n📖 方法2：使用JSON解析器 - ${path.basename(filePath)}`);
    console.log(`📏 块大小: ${chunkSize} 字符\n`);

    const handler = new LargeJSONHandler();
    const browser = new JSONStructureBrowser({ maxChunkSize: chunkSize });

    // 创建一个简单的分析器，因为SimpleJSONBrowser可能不存在
    const simpleAnalyzer = {
        async analyzeJSONStructure(filePath) {
            console.log('🔍 使用简单的JSON结构分析...');
            const handler = new LargeJSONHandler();
            const structure = {
                rootType: 'unknown',
                totalKeys: 0,
                objectCount: 0,
                arrayCount: 0,
                stringCount: 0,
                numberCount: 0,
                booleanCount: 0,
                nullCount: 0
            };

            try {
                let buffer = '';
                let braceCount = 0;
                let bracketCount = 0;
                let inString = false;
                let escapeNext = false;

                for await (const { chunk } of handler.readJSONInChunks(filePath, {
                    chunkSize: chunkSize,
                    pretty: true
                })) {
                    buffer += chunk;

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

                        if (char === '"' && !escapeNext) {
                            inString = !inString;
                            if (inString) {
                                structure.stringCount++;
                            }
                            continue;
                        }

                        if (inString) continue;

                        if (char === '{') {
                            braceCount++;
                            if (braceCount === 1) {
                                structure.objectCount++;
                            }
                        } else if (char === '}') {
                            braceCount--;
                        } else if (char === '[') {
                            bracketCount++;
                            if (bracketCount === 1) {
                                structure.arrayCount++;
                            }
                        } else if (char === ']') {
                            bracketCount--;
                        }
                    }

                    // 清理缓冲区，避免过大
                    if (buffer.length > 10000) {
                        buffer = buffer.slice(-5000);
                    }
                }

                // 估算总键数
                structure.totalKeys = Math.floor(structure.objectCount * 5);

            } catch (error) {
                console.error('简单分析失败:', error.message);
            }

            return structure;
        }
    };
    const startTime = performance.now();

    try {
        // 使用LargeJSONHandler读取文件
        console.log('🔄 正在使用LargeJSONHandler读取文件...');
        const chunks = [];
        let totalChunks = 0;

        await handler.readJSONInChunks(filePath, {
            chunkSize: chunkSize,
            progressCallback: (position, total) => {
                const progress = (position / total * 100).toFixed(1);
                console.log(`⏳ 进度: ${progress}% (${(position / 1024).toFixed(2)} / ${(total / 1024).toFixed(2)} KB)`);
            },
            dataCallback: (chunk, position) => {
                totalChunks++;
                chunks.push({
                    data: chunk,
                    position: position,
                    size: chunk.length
                });
            }
        });

        // 使用简单分析器分析结构
        console.log('\n🔍 使用简单分析器分析结构...');
        const structureResult = await simpleAnalyzer.analyzeJSONStructure(filePath);

        // 使用JSONStructureBrowser进行深度分析
        console.log('\n🔍 使用JSONStructureBrowser进行深度分析...');
        const deepResult = await browser.analyzeStructure(filePath);

        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);

        console.log(`\n✅ 方法2完成！`);
        console.log(`⏱️ 耗时: ${duration}ms`);
        console.log(`📦 处理了 ${totalChunks} 个数据块`);

        console.log('\n📊 简单结构分析结果:');
        if (structureResult) {
            console.log(`  - 根类型: ${structureResult.rootType}`);
            console.log(`  - 总键数: ${structureResult.totalKeys}`);
            console.log(`  - 总对象数: ${structureResult.objectCount}`);
            console.log(`  - 总数组数: ${structureResult.arrayCount}`);
            console.log(`  - 总字符串数: ${structureResult.stringCount}`);
            console.log(`  - 总数字数: ${structureResult.numberCount}`);
            console.log(`  - 总布尔数: ${structureResult.booleanCount}`);
            console.log(`  - 总null数: ${structureResult.nullCount}`);
        }

        console.log('\n📊 深度结构分析结果:');
        if (deepResult && deepResult.structure) {
            console.log(`  - 结构路径数: ${deepResult.structure.paths ? deepResult.structure.paths.length : 0}`);
            console.log(`  - 示例键: ${deepResult.sampleKeys ? deepResult.sampleKeys.slice(0, 5).join(', ') : 'N/A'}`);
            console.log(`  - 最大深度: ${deepResult.maxDepth || 'N/A'}`);
        }

        return {
            method: 'json-parser',
            duration: parseFloat(duration),
            chunks: totalChunks,
            structureResult: structureResult,
            deepResult: deepResult
        };

    } catch (error) {
        console.error(`❌ 方法2执行失败:`, error.message);
        return {
            method: 'json-parser',
            duration: 0,
            chunks: [],
            structureResult: null,
            deepResult: null,
            error: error.message
        };
    }
}

/**
 * 比较两种方法的结果
 * @param {Object} method1Result - 方法1的结果
 * @param {Object} method2Result - 方法2的结果
 * @param {string} filename - 文件名
 */
function compareMethods(method1Result, method2Result, filename) {
    console.log(`\n📈 ${filename} 两种方法性能对比:`);
    console.log('═'.repeat(60));
    console.log(`方法\t\t\t耗时\t\t状态`);
    console.log('─'.repeat(60));

    if (method1Result.error) {
        console.log(`文件偏移量\t\t失败\t\t${method1Result.error}`);
    } else {
        console.log(`文件偏移量\t\t${method1Result.duration}ms\t✅ 成功 (对象数: ${method1Result.objects.length})`);
    }

    if (method2Result.error) {
        console.log(`JSON解析器\t\t失败\t\t${method2Result.error}`);
    } else {
        console.log(`JSON解析器\t\t${method2Result.duration}ms\t✅ 成功 (数据块: ${method2Result.chunks.length})`);
    }

    // 性能比较
    if (!method1Result.error && !method2Result.error) {
        const diff = Math.abs(method1Result.duration - method2Result.duration);
        const faster = method1Result.duration < method2Result.duration ? '文件偏移量' : 'JSON解析器';
        console.log('\n🏆 性能分析:');
        console.log(`  - 时间差: ${diff}ms`);
        console.log(`  - 更快的方法: ${faster}`);
        const maxDuration = Math.max(method1Result.duration, method2Result.duration);
        const minDuration = Math.min(method1Result.duration, method2Result.duration);
        const efficiency = ((maxDuration - minDuration) / maxDuration) * 100;
        console.log(`  - 效率提升: ${efficiency.toFixed(1)}%`);
    }

    console.log('═'.repeat(60));
}

/**
 * 主函数
 */
async function main() {
    console.log('🚀 JSON文件优化读取器启动');
    console.log('═'.repeat(60));

    try {
        // 查找最大的两个JSON文件
        const largestFiles = await findLargestJSONFiles(__dirname);

        if (largestFiles.length === 0) {
            console.log('❌ 没有找到合适的JSON文件进行处理');
            return;
        }

        // 处理每个文件
        for (const file of largestFiles) {
            console.log(`\n🎯 处理文件: ${file.filename}`);
            console.log('═'.repeat(60));

            // 使用两种方法读取文件
            const [method1Result, method2Result] = await Promise.all([
                readByFileOffset(file.path),
                readWithJSONParser(file.path)
            ]);

            // 比较结果
            compareMethods(method1Result, method2Result, file.filename);

            console.log(`\n⏸️ 等待2秒后处理下一个文件...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log('\n🎉 所有文件处理完成！');
        console.log('═'.repeat(60));

    } catch (error) {
        console.error('❌ 程序执行失败:', error.message);
        console.error('详细错误:', error.stack);
    }
}

// 运行主函数
main();