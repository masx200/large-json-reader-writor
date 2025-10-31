#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import LargeJSONHandler from './index.js';
import JSONStructureBrowser from './json-browser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 深度分析JSON文件结构
 * @param {string} filePath - JSON文件路径
 * @param {string} fileName - 文件名
 * @returns {Promise<Object>} - 分析结果
 */
async function analyzeJSONFile(filePath, fileName) {
    console.log(`🔍 深度分析文件: ${fileName}`);
    console.log('═'.repeat(60));

    const handler = new LargeJSONHandler();
    const browser = new JSONStructureBrowser();
    const startTime = performance.now();

    const analysis = {
        fileName: fileName,
        filePath: filePath,
        timestamp: new Date().toISOString(),
        analysis: {},
        performance: {},
        structure: {},
        errors: []
    };

    try {
        // 获取文件基本信息
        const stats = await fs.promises.stat(filePath);
        analysis.fileInfo = {
            size: stats.size,
            sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
            sizeKB: (stats.size / 1024).toFixed(2),
            created: stats.birthtime,
            modified: stats.mtime
        };

        console.log(`📊 文件大小: ${analysis.fileInfo.sizeMB} MB (${analysis.fileInfo.sizeKB} KB)`);

        // 方法1: 快速统计分析
        console.log('\n📈 执行快速统计分析...');
        const quickStats = await quickStatsAnalysis(filePath, handler);
        analysis.analysis.quickStats = quickStats;

        // 方法2: 使用JSONStructureBrowser进行结构分析
        console.log('\n🏗️ 执行结构分析...');
        const structureAnalysis = await structureAnalysisMethod(filePath, browser);
        analysis.analysis.structureAnalysis = structureAnalysis;

        // 方法3: 分块详细分析
        console.log('\n🔬 执行分块详细分析...');
        const chunkAnalysis = await chunkAnalysisMethod(filePath, handler);
        analysis.analysis.chunkAnalysis = chunkAnalysis;

        // 性能测试
        console.log('\n⏱️ 执行性能测试...');
        const performanceResults = await performanceTest(filePath, handler);
        analysis.performance = performanceResults;

        const endTime = performance.now();
        analysis.analysis.totalTime = (endTime - startTime).toFixed(2);
        console.log(`\n✅ 分析完成！总耗时: ${analysis.analysis.totalTime}ms`);

    } catch (error) {
        console.error(`❌ 分析失败: ${error.message}`);
        analysis.errors.push(error.message);
    }

    return analysis;
}

/**
 * 快速统计分析
 */
async function quickStatsAnalysis(filePath, handler) {
    const stats = {
        estimatedObjects: 0,
        estimatedArrays: 0,
        estimatedStrings: 0,
        estimatedNumbers: 0,
        estimatedBooleans: 0,
        estimatedNulls: 0,
        estimatedTotalKeys: 0,
        maxDepth: 0
    };

    let buffer = '';
    let braceCount = 0;
    let bracketCount = 0;
    let maxBraceDepth = 0;
    let maxBracketDepth = 0;
    let inString = false;
    let escapeNext = false;

    for await (const { chunk } of handler.readJSONInChunks(filePath, {
        chunkSize: 1000,
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
                if (!inString) {
                    stats.estimatedStrings++;
                }
                inString = !inString;
                continue;
            }

            if (inString) continue;

            if (char === '{') {
                braceCount++;
                maxBraceDepth = Math.max(maxBraceDepth, braceCount);
                if (braceCount === 1) {
                    stats.estimatedObjects++;
                }
            } else if (char === '}') {
                braceCount--;
            } else if (char === '[') {
                bracketCount++;
                maxBracketDepth = Math.max(maxBracketDepth, bracketCount);
                if (bracketCount === 1) {
                    stats.estimatedArrays++;
                }
            } else if (char === ']') {
                bracketCount--;
            } else if (char === 't' || char === 'f') {
                // 检测 true/false
                if (buffer.substring(i, i + 4) === 'true') {
                    stats.estimatedBooleans++;
                    i += 3;
                } else if (buffer.substring(i, i + 5) === 'false') {
                    stats.estimatedBooleans++;
                    i += 4;
                }
            } else if (char === 'n') {
                // 检测 null
                if (buffer.substring(i, i + 4) === 'null') {
                    stats.estimatedNulls++;
                    i += 3;
                }
            } else if (char >= '0' && char <= '9') {
                // 检测数字
                let numStr = char;
                let j = i + 1;
                while (j < buffer.length && (buffer[j] >= '0' && buffer[j] <= '9' || buffer[j] === '.' || buffer[j] === 'e' || buffer[j] === 'E' || buffer[j] === '-')) {
                    numStr += buffer[j];
                    j++;
                }
                if (numStr !== '.' && numStr !== '-' && numStr.length > 0) {
                    stats.estimatedNumbers++;
                    i = j - 1;
                }
            }
        }

        if (buffer.length > 20000) {
            buffer = buffer.slice(-10000);
        }
    }

    stats.maxDepth = Math.max(maxBraceDepth, maxBracketDepth);
    stats.estimatedTotalKeys = Math.floor(stats.estimatedObjects * 5.5); // 平均每个对象5.5个键

    return stats;
}

/**
 * 结构分析方法
 */
async function structureAnalysisMethod(filePath, browser) {
    try {
        const structure = await browser.analyzeStructure(filePath);
        return {
            success: true,
            rootType: structure.type,
            structure: structure,
            analysisTime: 'completed'
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            analysisTime: 'failed'
        };
    }
}

/**
 * 分块分析方法
 */
async function chunkAnalysisMethod(filePath, handler) {
    const analysis = {
        totalChunks: 0,
        avgChunkSize: 0,
        maxChunkSize: 0,
        minChunkSize: 0,
        sampleChunks: [],
        structurePatterns: {}
    };

    let chunks = [];
    let totalSize = 0;

    for await (const { chunk, position } of handler.readJSONInChunks(filePath, {
        chunkSize: 500,
        pretty: true
    })) {
        chunks.push({
            size: chunk.length,
            position: position,
            content: chunk.substring(0, 100) + '...' // 只保存前100个字符
        });
        totalSize += chunk.length;
        analysis.totalChunks++;

        if (chunks.length <= 3) {
            analysis.sampleChunks.push({
                chunkNumber: chunks.length,
                size: chunk.length,
                preview: chunk.substring(0, 100)
            });
        }
    }

    if (chunks.length > 0) {
        analysis.avgChunkSize = Math.floor(totalSize / chunks.length);
        analysis.maxChunkSize = Math.max(...chunks.map(c => c.size));
        analysis.minChunkSize = Math.min(...chunks.map(c => c.size));
    }

    return analysis;
}

/**
 * 性能测试
 */
async function performanceTest(filePath, handler) {
    const tests = [];

    // 测试不同的块大小
    const chunkSizes = [100, 500, 1000, 2000];

    for (const chunkSize of chunkSizes) {
        const startTime = performance.now();
        let totalChunks = 0;

        for await (const { chunk } of handler.readJSONInChunks(filePath, {
            chunkSize: chunkSize,
            pretty: true
        })) {
            totalChunks++;
        }

        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);

        tests.push({
            chunkSize: chunkSize,
            duration: parseFloat(duration),
            chunks: totalChunks,
            speed: (totalChunks / parseFloat(duration)).toFixed(2)
        });
    }

    // 找出最快的配置
    const fastestTest = tests.reduce((prev, current) =>
        prev.speed > current.speed ? prev : current
    );

    return {
        tests: tests,
        fastest: fastestTest,
        recommendations: {
            optimalChunkSize: fastestTest.chunkSize,
            performance: fastestTest.speed
        }
    };
}

/**
 * 生成HTML报告
 */
function generateHTMLReport(analyses) {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>巨型JSON文件分析报告</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1, h2, h3 {
            color: #333;
            border-bottom: 2px solid #007acc;
            padding-bottom: 10px;
        }
        .file-section {
            margin: 30px 0;
            padding: 20px;
            background: #f9f9f9;
            border-radius: 8px;
            border-left: 4px solid #007acc;
        }
        .stat-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat-card {
            background: white;
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #007acc;
        }
        .stat-label {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }
        .performance-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .performance-table th,
        .performance-table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        .performance-table th {
            background-color: #007acc;
            color: white;
        }
        .performance-table tr:nth-child(even) {
            background-color: #f2f2f2;
        }
        .fastest {
            background-color: #d4edda;
            font-weight: bold;
        }
        .sample-chunk {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            margin: 10px 0;
            overflow-x: auto;
        }
        .timestamp {
            color: #666;
            font-size: 12px;
            text-align: right;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 巨型JSON文件分析报告</h1>
        <div class="timestamp">生成时间: ${new Date().toLocaleString('zh-CN')}</div>

        ${analyses.map(analysis => `
            <div class="file-section">
                <h2>📁 ${analysis.fileName}</h2>

                <div class="stat-grid">
                    <div class="stat-card">
                        <div class="stat-value">${analysis.fileInfo.sizeMB}</div>
                        <div class="stat-label">文件大小 (MB)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${analysis.analysis.totalTime}</div>
                        <div class="stat-label">分析耗时 (ms)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${analysis.analysis.quickStats.estimatedObjects}</div>
                        <div class="stat-label">估计对象数量</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${analysis.analysis.quickStats.estimatedArrays}</div>
                        <div class="stat-label">估计数组数量</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${analysis.analysis.quickStats.estimatedStrings}</div>
                        <div class="stat-label">估计字符串数量</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${analysis.analysis.quickStats.maxDepth}</div>
                        <div class="stat-label">最大深度</div>
                    </div>
                </div>

                <h3>📊 详细统计信息</h3>
                <div class="stat-grid">
                    <div class="stat-card">
                        <div class="stat-value">${analysis.analysis.quickStats.estimatedNumbers}</div>
                        <div class="stat-label">估计数字数量</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${analysis.analysis.quickStats.estimatedBooleans}</div>
                        <div class="stat-label">估计布尔值数量</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${analysis.analysis.quickStats.estimatedNulls}</div>
                        <div class="stat-label">估计null值数量</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${analysis.analysis.quickStats.estimatedTotalKeys}</div>
                        <div class="stat-label">估计总键数</div>
                    </div>
                </div>

                <h3>⚡ 性能测试结果</h3>
                <table class="performance-table">
                    <thead>
                        <tr>
                            <th>块大小</th>
                            <th>耗时 (ms)</th>
                            <th>处理块数</th>
                            <th>速度 (块/ms)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analysis.performance.tests.map(test => `
                            <tr ${test.chunkSize === analysis.performance.fastest.chunkSize ? 'class="fastest"' : ''}>
                                <td>${test.chunkSize}</td>
                                <td>${test.duration}</td>
                                <td>${test.chunks}</td>
                                <td>${test.speed}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <h3>🎯 性能建议</h3>
                <ul>
                    <li><strong>最优块大小:</strong> ${analysis.performance.recommendations.optimalChunkSize}</li>
                    <li><strong>最高处理速度:</strong> ${analysis.performance.recommendations.performance} 块/ms</li>
                </ul>

                <h3>📦 分块分析</h3>
                <div class="stat-grid">
                    <div class="stat-card">
                        <div class="stat-value">${analysis.analysis.chunkAnalysis.totalChunks}</div>
                        <div class="stat-label">总块数</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${analysis.analysis.chunkAnalysis.avgChunkSize}</div>
                        <div class="stat-label">平均块大小</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${analysis.analysis.chunkAnalysis.maxChunkSize}</div>
                        <div class="stat-label">最大块大小</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${analysis.analysis.chunkAnalysis.minChunkSize}</div>
                        <div class="stat-label">最小块大小</div>
                    </div>
                </div>

                <h3>🔍 示例块内容</h3>
                ${analysis.analysis.chunkAnalysis.sampleChunks.map(chunk => `
                    <div class="sample-chunk">
                        <strong>块 ${chunk.chunkNumber} (大小: ${chunk.size} 字符):</strong><br>
                        ${chunk.preview}
                    </div>
                `).join('')}

                <h3>📈 结构分析结果</h3>
                ${analysis.analysis.structureAnalysis.success ? `
                    <p><strong>根类型:</strong> ${analysis.analysis.structureAnalysis.rootType}</p>
                    <p><strong>分析状态:</strong> 成功</p>
                ` : `
                    <p><strong>分析状态:</strong> 失败 - ${analysis.analysis.structureAnalysis.error}</p>
                `}

            </div>
        `).join('')}
    </div>
</body>
</html>`;

    return html;
}

/**
 * 生成文本报告
 */
function generateTextReport(analyses) {
    let text = `🚀 巨型JSON文件分析报告\n`;
    text += `═`.repeat(60) + `\n`;
    text += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

    for (const analysis of analyses) {
        text += `📁 ${analysis.fileName}\n`;
        text += `═`.repeat(60) + `\n`;
        text += `文件大小: ${analysis.fileInfo.sizeMB} MB (${analysis.fileInfo.sizeKB} KB)\n`;
        text += `分析耗时: ${analysis.analysis.totalTime} ms\n\n`;

        text += `📊 基本统计信息:\n`;
        text += `  • 估计对象数量: ${analysis.analysis.quickStats.estimatedObjects}\n`;
        text += `  • 估计数组数量: ${analysis.analysis.quickStats.estimatedArrays}\n`;
        text += `  • 估计字符串数量: ${analysis.analysis.quickStats.estimatedStrings}\n`;
        text += `  • 估计数字数量: ${analysis.analysis.quickStats.estimatedNumbers}\n`;
        text += `  • 估计布尔值数量: ${analysis.analysis.quickStats.estimatedBooleans}\n`;
        text += `  • 估计null值数量: ${analysis.analysis.quickStats.estimatedNulls}\n`;
        text += `  • 估计总键数: ${analysis.analysis.quickStats.estimatedTotalKeys}\n`;
        text += `  • 最大深度: ${analysis.analysis.quickStats.maxDepth}\n\n`;

        text += `⚡ 性能测试结果:\n`;
        text += `块大小\t耗时(ms)\t块数\t速度(块/ms)\n`;
        text += `─`.repeat(50) + `\n`;
        for (const test of analysis.performance.tests) {
            const marker = test.chunkSize === analysis.performance.fastest.chunkSize ? ' ⭐' : '';
            text += `${test.chunkSize}\t\t${test.duration}\t\t${test.chunks}\t${test.speed}${marker}\n`;
        }
        text += `\n`;

        text += `🎯 性能建议:\n`;
        text += `  • 最优块大小: ${analysis.performance.recommendations.optimalChunkSize}\n`;
        text += `  • 最高处理速度: ${analysis.performance.recommendations.performance} 块/ms\n\n`;

        text += `📦 分块分析:\n`;
        text += `  • 总块数: ${analysis.analysis.chunkAnalysis.totalChunks}\n`;
        text += `  • 平均块大小: ${analysis.analysis.chunkAnalysis.avgChunkSize}\n`;
        text += `  • 最大块大小: ${analysis.analysis.chunkAnalysis.maxChunkSize}\n`;
        text += `  • 最小块大小: ${analysis.analysis.chunkAnalysis.minChunkSize}\n\n`;

        if (analysis.errors.length > 0) {
            text += `❌ 错误信息:\n`;
            for (const error of analysis.errors) {
                text += `  • ${error}\n`;
            }
            text += `\n`;
        }

        text += `\n`;
    }

    return text;
}

/**
 * 主函数
 */
async function main() {
    console.log('🚀 巨型JSON文件分析器启动');
    console.log('═'.repeat(60));

    try {
        // 查找JSON文件
        const files = await fs.promises.readdir(__dirname);
        const jsonFiles = files
            .filter(file => file.endsWith('.json') && !file.includes('test-data') && !file.includes('package'))
            .map(file => ({
                name: file,
                path: path.join(__dirname, file)
            }));

        if (jsonFiles.length === 0) {
            console.log('❌ 没有找到合适的JSON文件');
            return;
        }

        console.log(`📁 找到 ${jsonFiles.length} 个JSON文件待分析:`);
        jsonFiles.forEach((file, index) => {
            console.log(`${index + 1}. ${file.name}`);
        });

        // 分析每个文件
        const analyses = [];
        for (const file of jsonFiles) {
            const analysis = await analyzeJSONFile(file.path, file.name);
            analyses.push(analysis);
        }

        // 生成报告
        console.log('\n📝 生成分析报告...');

        const htmlReport = generateHTMLReport(analyses);
        const textReport = generateTextReport(analyses);

        // 保存报告
        const htmlReportPath = path.join(__dirname, 'json-analysis-report.html');
        const textReportPath = path.join(__dirname, 'json-analysis-report.txt');

        await fs.promises.writeFile(htmlReportPath, htmlReport);
        await fs.promises.writeFile(textReportPath, textReport);

        console.log(`✅ 报告生成完成!`);
        console.log(`📄 HTML报告: ${htmlReportPath}`);
        console.log(`📄 文本报告: ${textReportPath}`);

        // 显示摘要
        console.log('\n📋 分析摘要:');
        console.log('─'.repeat(40));
        for (const analysis of analyses) {
            console.log(`\n${analysis.fileName}:`);
            console.log(`  大小: ${analysis.fileInfo.sizeMB} MB`);
            console.log(`  对象数: ${analysis.analysis.quickStats.estimatedObjects}`);
            console.log(`  数组数: ${analysis.analysis.quickStats.estimatedArrays}`);
            console.log(`  字符串数: ${analysis.analysis.quickStats.estimatedStrings}`);
            console.log(`  建议块大小: ${analysis.performance.recommendations.optimalChunkSize}`);
        }

    } catch (error) {
        console.error('❌ 分析过程失败:', error.message);
    }
}

// 运行主函数
main();