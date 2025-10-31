import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前目录路径
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 合并JSON文件的函数
function mergeJsonFiles() {
    const mergedData = {};
    const files = fs.readdirSync(__dirname);

    // 筛选所有.json文件
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    // 排除输出文件
    const inputFiles = jsonFiles.filter(file => file !== 'merged_output.json');

    let successCount = 0;
    let errorCount = 0;

    inputFiles.forEach(file => {
        try {
            // 读取文件内容
            const content = fs.readFileSync(file, 'utf8');

            // 解析JSON
            const parsedContent = JSON.parse(content);

            // 使用文件名作为key（去掉.json扩展名）
            const key = path.basename(file, '.json');
            mergedData[key] = parsedContent;

            successCount++;
            console.log(`✅ 成功处理: ${file}`);
        } catch (error) {
            errorCount++;
            console.error(`❌ 处理失败: ${file} - ${error.message}`);
        }
    });

    // 写入合并后的文件
    try {
        const outputPath = 'merged_output.json';
        fs.writeFileSync(outputPath, JSON.stringify(mergedData, null, 2), 'utf8');

        console.log(`\n📊 合并完成:`);
        console.log(`   ✅ 成功处理 ${successCount} 个文件`);
        console.log(`   ❌ 失败 ${errorCount} 个文件`);
        console.log(`   📄 输出文件: ${outputPath}`);
        console.log(`   📊 总文件大小: ${Math.round(JSON.stringify(mergedData).length / 1024)} KB`);

        return true;
    } catch (error) {
        console.error(`❌ 写入输出文件失败: ${error.message}`);
        return false;
    }
}

// 验证JSON格式的函数
function validateJsonFiles() {
    console.log('🔍 验证JSON文件格式...');
    console.log(`当前目录: ${__dirname}`);
    const files = fs.readdirSync(__dirname);
    console.log(`目录中的文件数量: ${files.length}`);

    const jsonFiles = files.filter(file => file.endsWith('.json') && file !== 'merged_output.json');
    console.log(`JSON文件数量: ${jsonFiles.length}`);

    let validCount = 0;
    let invalidFiles = [];

    jsonFiles.forEach(file => {
        try {
            const content = fs.readFileSync(file, 'utf8');
            JSON.parse(content);
            validCount++;
        } catch (error) {
            invalidFiles.push({ file, error: error.message });
        }
    });

    console.log(`📊 验证结果:`);
    console.log(`   ✅ 合法JSON: ${validCount} 个文件`);
    console.log(`   ❌ 非法JSON: ${invalidFiles.length} 个文件`);

    if (invalidFiles.length > 0) {
        console.log(`\n❌ 非法文件列表:`);
        invalidFiles.forEach(({ file, error }) => {
            console.log(`   - ${file}: ${error}`);
        });
    }

    return invalidFiles.length === 0;
}

// 主函数
function main() {
    console.log('🚀 开始合并JSON文件...\n');

    try {
        // 首先验证所有JSON文件格式
        const allValid = validateJsonFiles();

        if (!allValid) {
            console.log('\n⚠️  存在非法JSON文件，是否继续合并？(y/n)');
            // 由于是批量处理，我们直接继续，但会跳过非法文件
            console.log('继续合并，将跳过非法JSON文件...\n');
        }

        // 执行合并
        const success = mergeJsonFiles();

        if (success) {
            console.log('\n🎉 合并任务完成！');
        } else {
            console.log('\n💥 合并任务失败！');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n💥 程序运行出错:', error.message);
        process.exit(1);
    }
}

// 运行主函数
if (import.meta.main) {
    main();
}

export { mergeJsonFiles, validateJsonFiles };