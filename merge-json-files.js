import fs from 'fs';
import path from 'path';

/**
 * 合并JSON文件工具
 * 将指定目录中的所有JSON文件合并成一个文件
 * 文件名作为key，文件内容作为value
 */

class JsonMerger {
    constructor(options = {}) {
        this.options = {
            inputDir: '.',
            outputFile: 'merged_output.json',
            excludeFiles: ['merged_output.json', 'package.json'],
            verbose: false,
            ...options
        };

        this.stats = {
            totalFiles: 0,
            successful: 0,
            failed: 0,
            skipped: 0
        };
    }

    /**
     * 获取所有JSON文件
     */
    getJsonFiles() {
        try {
            const files = fs.readdirSync(this.options.inputDir);
            const jsonFiles = files.filter(file =>
                file.endsWith('.json') &&
                !this.options.excludeFiles.includes(file)
            );

            this.stats.totalFiles = jsonFiles.length;

            if (this.options.verbose) {
                console.log(`找到 ${jsonFiles.length} 个JSON文件:`);
                jsonFiles.forEach(file => console.log(`  - ${file}`));
            }

            return jsonFiles;
        } catch (error) {
            throw new Error(`读取目录失败: ${error.message}`);
        }
    }

    /**
     * 验证JSON文件格式
     */
    validateJsonFiles(jsonFiles) {
        const validFiles = [];
        const invalidFiles = [];

        jsonFiles.forEach(file => {
            try {
                const content = fs.readFileSync(
                    path.join(this.options.inputDir, file),
                    'utf8'
                );
                JSON.parse(content);
                validFiles.push(file);
            } catch (error) {
                invalidFiles.push({ file, error: error.message });
            }
        });

        if (invalidFiles.length > 0) {
            console.warn(`⚠️  发现 ${invalidFiles.length} 个非法JSON文件:`);
            invalidFiles.forEach(({ file, error }) => {
                console.warn(`   ❌ ${file}: ${error}`);
            });
        }

        return { validFiles, invalidFiles };
    }

    /**
     * 合并JSON文件
     */
    mergeJsonFiles() {
        const jsonFiles = this.getJsonFiles();
        const { validFiles, invalidFiles } = this.validateJsonFiles(jsonFiles);

        const mergedData = {};

        validFiles.forEach(file => {
            try {
                const filePath = path.join(this.options.inputDir, file);
                const content = fs.readFileSync(filePath, 'utf8');
                const jsonData = JSON.parse(content);

                // 使用文件名（不带扩展名）作为key
                const key = path.basename(file, '.json');
                mergedData[key] = jsonData;

                this.stats.successful++;

                if (this.options.verbose) {
                    console.log(`✅ 成功处理: ${file}`);
                }
            } catch (error) {
                this.stats.failed++;
                console.error(`❌ 处理失败: ${file} - ${error.message}`);
            }
        });

        this.stats.skipped = invalidFiles.length;

        return mergedData;
    }

    /**
     * 保存合并后的文件
     */
    saveMergedData(data) {
        try {
            const outputPath = path.join(this.options.inputDir, this.options.outputFile);
            const jsonString = JSON.stringify(data, null, 2);

            fs.writeFileSync(outputPath, jsonString, 'utf8');

            console.log(`\n📊 合并完成:`);
            console.log(`   📁 输出文件: ${outputPath}`);
            console.log(`   📊 文件大小: ${Math.round(jsonString.length / 1024)} KB`);
            console.log(`   🗂️  数据条目: ${Object.keys(data).length}`);
            console.log(`   ✅ 成功处理: ${this.stats.successful} 个文件`);
            console.log(`   ❌ 处理失败: ${this.stats.failed} 个文件`);
            console.log(`   ⏭️  跳过文件: ${this.stats.skipped} 个文件`);

            return true;
        } catch (error) {
            console.error(`❌ 保存文件失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 执行合并
     */
    run() {
        console.log('🚀 开始合并JSON文件...\n');

        try {
            const mergedData = this.mergeJsonFiles();
            const success = this.saveMergedData(mergedData);

            if (success) {
                console.log('\n🎉 合并任务完成！');
                return true;
            } else {
                console.log('\n💥 合并任务失败！');
                return false;
            }
        } catch (error) {
            console.error(`\n💥 程序运行出错: ${error.message}`);
            return false;
        }
    }
}

// 命令行入口
function main() {
    const args = process.argv.slice(2);
    const options = {};

    // 解析命令行参数
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-v' || args[i] === '--verbose') {
            options.verbose = true;
        } else if (args[i] === '-o' || args[i] === '--output') {
            options.outputFile = args[++i];
        } else if (args[i] === '-d' || args[i] === '--dir') {
            options.inputDir = args[++i];
        } else if (args[i] === '-h' || args[i] === '--help') {
            showHelp();
            process.exit(0);
        }
    }

    const merger = new JsonMerger(options);
    const success = merger.run();

    process.exit(success ? 0 : 1);
}

/**
 * 显示帮助信息
 */
function showHelp() {
    console.log(`
📋 JSON文件合并工具

用法: node merge-json-files.js [选项]

选项:
  -v, --verbose      显示详细处理过程
  -o, --output FILE  指定输出文件名 (默认: merged_output.json)
  -d, --dir DIR      指定输入目录 (默认: 当前目录)
  -h, --help         显示帮助信息

示例:
  node merge-json-files.js                    # 基本用法
  node merge-json-files.js -v                 # 显示详细过程
  node merge-json-files.js -o result.json    # 指定输出文件
  node merge-json-files.js -d ./data         # 指定输入目录

功能:
  - 自动扫描目录中的所有JSON文件
  - 验证JSON文件格式的合法性
  - 使用文件名作为key，文件内容作为value
  - 输出格式化的JSON文件
  - 显示处理统计信息
`);
}

// 如果直接运行此文件
if (process.argv[1] && process.argv[1].endsWith('merge-json-files.js')) {
    main();
} else if (!process.argv[1]) {
    // 直接运行时没有参数
    main();
} else {
    console.log('📋 JSON文件合并工具 - 使用方法:');
    console.log('  node merge-json-files.js [选项]');
    console.log('  node merge-json-files.js --help  查看详细帮助');
}

export { JsonMerger };