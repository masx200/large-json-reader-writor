import streamChain from 'stream-chain';
import streamJson from 'stream-json';
import streamValues from 'stream-json/streamers/StreamValues.js';
import streamObject from 'stream-json/streamers/StreamObject.js';
import streamArray from 'stream-json/streamers/StreamArray.js';
import fs from 'fs';
import path from 'path';

class DeepStreamAnalyzer {
    constructor() {
        this.stats = {
            totalSize: 0,
            objects: 0,
            arrays: 0,
            strings: 0,
            numbers: 0,
            booleans: 0,
            nulls: 0,
            keyFrequency: new Map(),
            paths: new Map(),
            maxDepth: 0,
            processingTime: 0,
            totalKeys: 0
        };
        this.currentPath = [];
        this.currentDepth = 0;
    }

    async analyzeFile(filePath) {
        const startTime = Date.now();
        console.log(`🔍 深度分析: ${filePath}`);

        // 获取文件大小
        const fileStats = fs.statSync(filePath);
        this.stats.totalSize = fileStats.size;
        console.log(`📁 文件大小: ${(this.stats.totalSize / 1024).toFixed(2)} KB`);

        return new Promise((resolve, reject) => {
            try {
                // 使用StreamValues来获取所有值，包括嵌套的
                const pipeline = streamChain.chain([
                    fs.createReadStream(filePath),
                    streamJson.parser(),
                    new streamValues()
                ]);

                pipeline.on('data', (data) => {
                    this.processStreamData(data);
                });

                pipeline.on('end', () => {
                    this.stats.processingTime = Date.now() - startTime;
                    const report = this.generateReport(filePath);
                    console.log(`✅ 深度分析完成: ${this.stats.processingTime}ms`);
                    console.log(`📊 发现 ${this.stats.totalKeys} 个键值对`);
                    resolve(report);
                });

                pipeline.on('error', (error) => {
                    console.error('❌ 流式处理错误:', error);
                    reject(error);
                });

            } catch (error) {
                console.error('❌ 创建分析管道失败:', error);
                reject(error);
            }
        });
    }

    processStreamData(data) {
        if (data.value !== undefined) {
            // 递归处理值，深入所有嵌套结构
            this.deepAnalyzeValue(data.value, this.currentPath);
        }
    }

    deepAnalyzeValue(value, currentPath = []) {
        const type = this.getValueType(value);
        const pathStr = currentPath.join('.');

        // 更新类型统计
        this.updateTypeStats(type);

        // 更新路径统计
        this.updatePathStats(pathStr, type, value);

        // 更新最大深度
        this.stats.maxDepth = Math.max(this.stats.maxDepth, currentPath.length);

        // 如果是对象或数组，递归处理
        if (type === 'object' && value !== null) {
            Object.entries(value).forEach(([key, val]) => {
                const newPath = [...currentPath, key];
                this.stats.keyFrequency.set(key, (this.stats.keyFrequency.get(key) || 0) + 1);
                this.stats.totalKeys++;
                this.deepAnalyzeValue(val, newPath);
            });
        } else if (type === 'array') {
            value.forEach((item, index) => {
                const newPath = [...currentPath, `[${index}]`];
                this.deepAnalyzeValue(item, newPath);
            });
        }
    }

    updateTypeStats(type) {
        switch (type) {
            case 'object':
                this.stats.objects++;
                break;
            case 'array':
                this.stats.arrays++;
                break;
            case 'string':
                this.stats.strings++;
                break;
            case 'number':
                this.stats.numbers++;
                break;
            case 'boolean':
                this.stats.booleans++;
                break;
            case 'null':
                this.stats.nulls++;
                break;
        }
    }

    updatePathStats(pathStr, type, value) {
        if (!this.stats.paths.has(pathStr)) {
            this.stats.paths.set(pathStr, {
                type: type,
                count: 0,
                examples: []
            });
        }

        const pathInfo = this.stats.paths.get(pathStr);
        pathInfo.count++;

        if (pathInfo.examples.length < 3) {
            pathInfo.examples.push(value);
        }
    }

    getValueType(value) {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'object') return 'object';
        if (typeof value === 'string') return 'string';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'boolean';
        return 'unknown';
    }

    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    generateReport(filePath) {
        const fileName = path.basename(filePath);
        const reportDate = new Date().toISOString();
        const totalElements = this.stats.objects + this.stats.arrays + this.stats.strings +
                             this.stats.numbers + this.stats.booleans + this.stats.nulls;

        let report = `# 深度JSON分析报告: ${fileName}\n\n`;
        report += `**生成时间:** ${reportDate}\n`;
        report += `**文件路径:** ${filePath}\n`;
        report += `**文件大小:** ${this.formatFileSize(this.stats.totalSize)}\n`;
        report += `**处理时间:** ${this.stats.processingTime}ms\n`;
        report += `**发现键值对:** ${this.stats.totalKeys}\n\n`;

        // 基本统计
        report += `## 📊 基本统计\n\n`;
        report += `| 指标 | 数量 |\n`;
        report += `|------|------|\n`;
        report += `| **总元素数** | ${totalElements} |\n`;
        report += `| **对象数** | ${this.stats.objects} |\n`;
        report += `| **数组数** | ${this.stats.arrays} |\n`;
        report += `| **字符串数** | ${this.stats.strings} |\n`;
        report += `| **数字数** | ${this.stats.numbers} |\n`;
        report += `| **布尔值数** | ${this.stats.booleans} |\n`;
        report += `| **空值数** | ${this.stats.nulls} |\n`;
        report += `| **最大深度** | ${this.stats.maxDepth} |\n`;
        report += `| **唯一键数** | ${this.stats.keyFrequency.size} |\n\n`;

        // 数据类型分布
        if (totalElements > 0) {
            report += `## 🎯 数据类型分布\n\n`;
            report += `| 类型 | 数量 | 百分比 |\n`;
            report += `|------|------|--------|\n`;
            report += `| **对象** | ${this.stats.objects} | ${((this.stats.objects / totalElements) * 100).toFixed(1)}% |\n`;
            report += `| **数组** | ${this.stats.arrays} | ${((this.stats.arrays / totalElements) * 100).toFixed(1)}% |\n`;
            report += `| **字符串** | ${this.stats.strings} | ${((this.stats.strings / totalElements) * 100).toFixed(1)}% |\n`;
            report += `| **数字** | ${this.stats.numbers} | ${((this.stats.numbers / totalElements) * 100).toFixed(1)}% |\n`;
            report += `| **布尔值** | ${this.stats.booleans} | ${((this.stats.booleans / totalElements) * 100).toFixed(1)}% |\n`;
            report += `| **空值** | ${this.stats.nulls} | ${((this.stats.nulls / totalElements) * 100).toFixed(1)}%\n\n`;
        }

        // 最频繁的键
        if (this.stats.keyFrequency.size > 0) {
            report += `## 🔑 最频繁的键\n\n`;
            const sortedKeys = Array.from(this.stats.keyFrequency.entries())
                .sort(([,a], [,b]) => b - a)
                .slice(0, 20);

            sortedKeys.forEach(([key, count]) => {
                report += `- **\`${key}\`:** 出现 ${count} 次\n`;
            });
            report += `\n`;
        }

        // 重要的路径
        if (this.stats.paths.size > 0) {
            report += `## 🗺️ 重要路径 (按出现频率)\n\n`;
            const sortedPaths = Array.from(this.stats.paths.entries())
                .sort(([,a], [,b]) => b.count - a.count)
                .slice(0, 15);

            sortedPaths.forEach(([path, info]) => {
                report += `### \`${path}\`\n`;
                report += `- **类型:** ${info.type}\n`;
                report += `- **出现次数:** ${info.count}\n`;
                if (info.examples.length > 0) {
                    const example = info.examples[0];
                    const exampleStr = typeof example === 'string' ? `"${example}"` : JSON.stringify(example);
                    report += `- **示例:** ${exampleStr}\n`;
                }
                report += `\n`;
            });
        }

        // 性能指标
        report += `## ⚡ 性能指标\n\n`;
        report += `- **处理时间:** ${this.stats.processingTime}ms\n`;
        report += `- **处理速度:** ${(this.stats.totalSize / 1024 / (this.stats.processingTime / 1000)).toFixed(2)} KB/s\n`;
        report += `- **内存效率:** 使用递归流式处理，完整解析嵌套结构\n\n`;

        // 数据洞察
        report += `## 💡 数据洞察\n\n`;

        if (this.stats.maxDepth > 5) {
            report += `- **复杂嵌套结构:** 文件具有深层嵌套 (最大深度: ${this.stats.maxDepth})\n`;
        } else {
            report += `- **简单结构:** 文件嵌套层次较浅 (最大深度: ${this.stats.maxDepth})\n`;
        }

        if (this.stats.arrays > this.stats.objects) {
            report += `- **数组导向:** 数组数量多于对象，可能是列表型数据\n`;
        } else {
            report += `- **对象导向:** 对象数量多于数组，可能是结构型数据\n`;
        }

        if (this.stats.strings > this.stats.numbers) {
            report += `- **文本密集:** 字符串数量多于数字，包含大量文本内容\n`;
        } else {
            report += `- **数值密集:** 数字数量多于字符串，包含大量数值数据\n`;
        }

        // 估算数据密度
        const density = totalElements / (this.stats.totalSize / 1024);
        if (density > 10) {
            report += `- **高密度数据:** 每KB约 ${density.toFixed(1)} 个元素\n`;
        } else {
            report += `- **低密度数据:** 每KB约 ${density.toFixed(1)} 个元素\n`;
        }

        // 键值对密度
        const keyDensity = this.stats.totalKeys / (this.stats.totalSize / 1024);
        report += `- **键值对密度:** 每KB约 ${keyDensity.toFixed(1)} 个键值对\n`;

        report += `\n---\n\n*报告由深度JSON流式分析器生成，使用递归解析技术*`;

        return report;
    }

    async saveReport(report, outputPath) {
        await fs.promises.writeFile(outputPath, report, 'utf8');
        console.log(`📊 深度分析报告已保存到: ${outputPath}`);
    }

    resetStats() {
        this.stats = {
            totalSize: 0,
            objects: 0,
            arrays: 0,
            strings: 0,
            numbers: 0,
            booleans: 0,
            nulls: 0,
            keyFrequency: new Map(),
            paths: new Map(),
            maxDepth: 0,
            processingTime: 0,
            totalKeys: 0
        };
        this.currentPath = [];
        this.currentDepth = 0;
    }

    async analyzeMultipleFiles(filePaths) {
        const results = [];

        for (const filePath of filePaths) {
            try {
                if (fs.existsSync(filePath)) {
                    console.log(`\n🚀 开始深度分析: ${filePath}`);
                    const report = await this.analyzeFile(filePath);

                    // 保存Markdown报告
                    const outputFileName = `deep-analysis-${path.basename(filePath, '.json')}.md`;
                    await this.saveReport(report, outputFileName);

                    results.push({
                        filePath,
                        success: true,
                        reportPath: outputFileName,
                        totalKeys: this.stats.totalKeys,
                        processingTime: this.stats.processingTime
                    });

                    // 重置统计以备下次分析
                    this.resetStats();

                } else {
                    console.log(`❌ 文件不存在: ${filePath}`);
                    results.push({
                        filePath,
                        success: false,
                        error: 'File not found'
                    });
                }
            } catch (error) {
                console.error(`❌ 深度分析失败 ${filePath}:`, error.message);
                results.push({
                    filePath,
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }
}

// 主执行函数
async function main() {
    const analyzer = new DeepStreamAnalyzer();

    const files = [
        'D:\\projects\\large-json-reader-writor\\test-output.json',
        'D:\\projects\\large-json-reader-writor\\large-example.json',
        'D:\\projects\\large-json-reader-writor\\openapi.json'
    ];

    console.log('🎯 深度JSON流式分析器 - 使用递归解析完整嵌套结构\n');

    try {
        const results = await analyzer.analyzeMultipleFiles(files);

        console.log('\n=== 深度分析完成 ===');
        console.log(`✅ 成功分析: ${results.filter(r => r.success).length} 个文件`);
        console.log(`❌ 失败: ${results.filter(r => !r.success).length} 个文件`);

        results.forEach(result => {
            if (result.success) {
                console.log(`✅ ${result.filePath} -> ${result.reportPath} (${result.totalKeys} 个键值对, ${result.processingTime}ms)`);
            } else {
                console.log(`❌ ${result.filePath}: ${result.error}`);
            }
        });

    } catch (error) {
        console.error('❌ 深度分析过程中发生错误:', error);
        process.exit(1);
    }
}

main().catch(console.error);

export default DeepStreamAnalyzer;