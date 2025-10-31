import streamChain from 'stream-chain';
import streamJson from 'stream-json';
import streamValuesModule from 'stream-json/streamers/StreamValues.js';
import fs from 'fs';
import path from 'path';

class ComprehensiveStreamAnalyzer {
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
            processingTime: 0
        };
    }

    async analyzeFile(filePath) {
        const startTime = Date.now();
        console.log(`🔍 Analyzing: ${filePath}`);

        // Get file size
        const fileStats = fs.statSync(filePath);
        this.stats.totalSize = fileStats.size;
        console.log(`📁 File size: ${(this.stats.totalSize / 1024).toFixed(2)} KB`);

        return new Promise((resolve, reject) => {
            try {
                const pipeline = streamChain.chain([
                    fs.createReadStream(filePath),
                    streamJson.parser(),
                    new streamValuesModule()
                ]);

                let currentPath = [];
                let currentDepth = 0;

                pipeline.on('data', (data) => {
                    if (data.key !== undefined) {
                        // Update path tracking
                        currentPath = currentPath.slice(0, data.depth - 1);
                        currentPath.push(data.key);
                        currentDepth = data.depth;

                        // Update statistics
                        this.updateStats(data.value, currentPath);
                    }
                });

                pipeline.on('end', () => {
                    this.stats.processingTime = Date.now() - startTime;
                    const report = this.generateReport(filePath);
                    console.log(`✅ Analysis complete: ${this.stats.processingTime}ms`);
                    resolve(report);
                });

                pipeline.on('error', (error) => {
                    console.error('❌ Stream processing error:', error);
                    reject(error);
                });

            } catch (error) {
                console.error('❌ Pipeline creation failed:', error);
                reject(error);
            }
        });
    }

    updateStats(value, path) {
        const type = this.getValueType(value);
        const pathStr = path.join('.');

        // Update type counts
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

        // Update max depth
        this.stats.maxDepth = Math.max(this.stats.maxDepth, path.length);

        // Track key frequency
        if (path.length > 0) {
            const lastKey = path[path.length - 1];
            this.stats.keyFrequency.set(lastKey, (this.stats.keyFrequency.get(lastKey) || 0) + 1);
        }

        // Track paths
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

        let report = `# JSON Analysis Report: ${fileName}\n\n`;
        report += `**Generated:** ${reportDate}\n`;
        report += `**File:** ${filePath}\n`;
        report += `**Size:** ${this.formatFileSize(this.stats.totalSize)}\n`;
        report += `**Processing Time:** ${this.stats.processingTime}ms\n\n`;

        // Basic statistics
        report += `## 📊 Basic Statistics\n\n`;
        report += `| Metric | Count |\n`;
        report += `|--------|-------|\n`;
        report += `| **Total Elements** | ${totalElements} |\n`;
        report += `| **Objects** | ${this.stats.objects} |\n`;
        report += `| **Arrays** | ${this.stats.arrays} |\n`;
        report += `| **Strings** | ${this.stats.strings} |\n`;
        report += `| **Numbers** | ${this.stats.numbers} |\n`;
        report += `| **Booleans** | ${this.stats.booleans} |\n`;
        report += `| **Nulls** | ${this.stats.nulls} |\n`;
        report += `| **Max Depth** | ${this.stats.maxDepth} |\n`;
        report += `| **Unique Keys** | ${this.stats.keyFrequency.size} |\n\n`;

        // Data type distribution
        if (totalElements > 0) {
            report += `## 🎯 Data Type Distribution\n\n`;
            report += `| Type | Count | Percentage |\n`;
            report += `|------|-------|------------|\n`;
            report += `| **Objects** | ${this.stats.objects} | ${((this.stats.objects / totalElements) * 100).toFixed(1)}% |\n`;
            report += `| **Arrays** | ${this.stats.arrays} | ${((this.stats.arrays / totalElements) * 100).toFixed(1)}% |\n`;
            report += `| **Strings** | ${this.stats.strings} | ${((this.stats.strings / totalElements) * 100).toFixed(1)}% |\n`;
            report += `| **Numbers** | ${this.stats.numbers} | ${((this.stats.numbers / totalElements) * 100).toFixed(1)}% |\n`;
            report += `| **Booleans** | ${this.stats.booleans} | ${((this.stats.booleans / totalElements) * 100).toFixed(1)}% |\n`;
            report += `| **Nulls** | ${this.stats.nulls} | ${((this.stats.nulls / totalElements) * 100).toFixed(1)}% |\n\n`;
        }

        // Most frequent keys
        if (this.stats.keyFrequency.size > 0) {
            report += `## 🔑 Most Frequent Keys\n\n`;
            const sortedKeys = Array.from(this.stats.keyFrequency.entries())
                .sort(([,a], [,b]) => b - a)
                .slice(0, 20);

            sortedKeys.forEach(([key, count]) => {
                report += `- **\`${key}\`:** Appears ${count} times\n`;
            });
            report += `\n`;
        }

        // Important paths
        if (this.stats.paths.size > 0) {
            report += `## 🗺️ Important Paths (by frequency)\n\n`;
            const sortedPaths = Array.from(this.stats.paths.entries())
                .sort(([,a], [,b]) => b.count - a.count)
                .slice(0, 15);

            sortedPaths.forEach(([path, info]) => {
                report += `### \`${path}\`\n`;
                report += `- **Type:** ${info.type}\n`;
                report += `- **Count:** ${info.count}\n`;
                if (info.examples.length > 0) {
                    const example = info.examples[0];
                    const exampleStr = typeof example === 'string' ? `"${example}"` : JSON.stringify(example);
                    report += `- **Example:** ${exampleStr}\n`;
                }
                report += `\n`;
            });
        }

        // Performance metrics
        report += `## ⚡ Performance Metrics\n\n`;
        report += `- **Processing Time:** ${this.stats.processingTime}ms\n`;
        report += `- **Processing Speed:** ${(this.stats.totalSize / 1024 / (this.stats.processingTime / 1000)).toFixed(2)} KB/s\n`;
        report += `- **Memory Efficiency:** Using stream processing, low memory footprint\n\n`;

        // Data insights
        report += `## 💡 Data Insights\n\n`;

        if (this.stats.maxDepth > 5) {
            report += `- **Complex Nested Structure:** File has deep nesting (max depth: ${this.stats.maxDepth})\n`;
        } else {
            report += `- **Simple Structure:** File has shallow nesting (max depth: ${this.stats.maxDepth})\n`;
        }

        if (this.stats.arrays > this.stats.objects) {
            report += `- **Array-Oriented:** More arrays than objects, likely list-type data\n`;
        } else {
            report += `- **Object-Oriented:** More objects than arrays, likely structured data\n`;
        }

        if (this.stats.strings > this.stats.numbers) {
            report += `- **Text-Intensive:** More strings than numbers, contains lots of text content\n`;
        } else {
            report += `- **Numeric-Intensive:** More numbers than strings, contains lots of numerical data\n`;
        }

        // Estimate data density
        const density = totalElements / (this.stats.totalSize / 1024);
        if (density > 10) {
            report += `- **High-Density Data:** ~${density.toFixed(1)} elements per KB\n`;
        } else {
            report += `- **Low-Density Data:** ~${density.toFixed(1)} elements per KB\n`;
        }

        report += `\n---\n\n*Report generated by Stream JSON Analyzer using stream-json and stream-chain*`;

        return report;
    }

    async saveReport(report, outputPath) {
        await fs.promises.writeFile(outputPath, report, 'utf8');
        console.log(`📊 Report saved to: ${outputPath}`);
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
            processingTime: 0
        };
    }

    async analyzeMultipleFiles(filePaths) {
        const results = [];

        for (const filePath of filePaths) {
            try {
                if (fs.existsSync(filePath)) {
                    console.log(`\n🚀 Starting analysis: ${filePath}`);
                    const report = await this.analyzeFile(filePath);

                    // Save Markdown report
                    const outputFileName = `comprehensive-analysis-${path.basename(filePath, '.json')}.md`;
                    await this.saveReport(report, outputFileName);

                    results.push({
                        filePath,
                        success: true,
                        reportPath: outputFileName
                    });

                    // Reset stats for next file
                    this.resetStats();

                } else {
                    console.log(`❌ File not found: ${filePath}`);
                    results.push({
                        filePath,
                        success: false,
                        error: 'File not found'
                    });
                }
            } catch (error) {
                console.error(`❌ Analysis failed for ${filePath}:`, error.message);
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

// Main execution
async function main() {
    const analyzer = new ComprehensiveStreamAnalyzer();

    const files = [
        'D:\\projects\\large-json-reader-writor\\test-output.json',
        'D:\\projects\\large-json-reader-writor\\large-example.json',
        'D:\\projects\\large-json-reader-writor\\openapi.json'
    ];

    console.log('🎯 Comprehensive Stream JSON Analyzer - Using stream-json and stream-chain\n');

    try {
        const results = await analyzer.analyzeMultipleFiles(files);

        console.log('\n=== Analysis Complete ===');
        console.log(`✅ Successfully analyzed: ${results.filter(r => r.success).length} files`);
        console.log(`❌ Failed: ${results.filter(r => !r.success).length} files`);

        results.forEach(result => {
            if (result.success) {
                console.log(`✅ ${result.filePath} -> ${result.reportPath}`);
            } else {
                console.log(`❌ ${result.filePath}: ${result.error}`);
            }
        });

    } catch (error) {
        console.error('❌ Error during analysis:', error);
        process.exit(1);
    }
}

main().catch(console.error);

export default ComprehensiveStreamAnalyzer;