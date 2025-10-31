import JSONStructureBrowser from './json-browser.js';
import StreamingJSONParser from './json-parser.js';
import InteractiveJSONBrowser from './interactive-browser.js';

async function runBrowserExample() {
    const browser = new JSONStructureBrowser();
    const parser = new StreamingJSONParser();

    console.log('=== JSON 结构浏览器示例 ===\n');

    // 示例1：分析文件结构
    console.log('🔍 示例1：分析 JSON 文件结构');
    try {
        const structure = await parser.getBasicStructure('./openapi.json');
        console.log('✅ 结构分析成功！');
        console.log('📊 基本信息:');
        console.log(`  - 根类型: ${structure.type}`);
        console.log(`  - 顶级键: ${structure.topLevelKeys.join(', ')}`);
        console.log(`  - 对象数量: ${structure.objectCount}`);
        console.log(`  - 数组数量: ${structure.arrayCount}`);

    } catch (error) {
        console.error('结构分析失败:', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 示例2：导航到特定路径
    console.log('🗺️  示例2：路径导航');
    try {
        const paths = [
            'info',
            'info.title',
            'paths',
            'components',
            'openapi'
        ];

        for (const path of paths) {
            console.log(`\n📍 导航到: ${path}`);
            try {
                const info = await parser.getPathInfo('./openapi.json', path);
                console.log(`  类型: ${info.type}`);
                if (info.value) {
                    console.log(`  值: ${info.value}`);
                }
                if (info.error) {
                    console.log(`  错误: ${info.error}`);
                }
            } catch (error) {
                console.error(`导航到 ${path} 失败: ${error.message}`);
            }
        }

    } catch (error) {
        console.error('导航示例失败:', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 示例3：搜索功能
    console.log('🔎 示例3：流式搜索功能');
    try {
        const searchTerms = ['title', 'openapi', 'paths', 'components'];

        for (const term of searchTerms) {
            console.log(`\n🔍 搜索: "${term}"`);
            console.log('  (流式搜索需要更多实现，这里展示基本结构)');

            // 使用基本统计代替搜索
            const structure = await parser.getBasicStructure('./openapi.json');
            const containsTerm = structure.topLevelKeys.some(key =>
                key.toLowerCase().includes(term.toLowerCase())
            );

            if (containsTerm) {
                console.log(`  ✅ 在顶级键中找到包含 "${term}" 的键`);
                const matchingKeys = structure.topLevelKeys.filter(key =>
                    key.toLowerCase().includes(term.toLowerCase())
                );
                console.log(`  匹配键: ${matchingKeys.join(', ')}`);
            } else {
                console.log(`  ❌ 顶级键中未找到 "${term}"`);
            }
        }

    } catch (error) {
        console.error('搜索示例失败:', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 示例4：深度分析
    console.log('🔬 示例4：深度结构分析');
    try {
        console.log('分析 API 路径结构...\n');

        // 获取 paths 对象
        const pathsStructure = await browser.navigateToPath('./openapi.json', 'paths');
        if (pathsStructure) {
            console.log('📋 API 路径概览:');
            console.log(browser.displayStructure(pathsStructure));

            // 分析每个路径的方法
            if (pathsStructure.children) {
                console.log('\n📊 API 方法统计:');
                const methodCount = { get: 0, post: 0, put: 0, delete: 0, patch: 0, other: 0 };

                for (const child of pathsStructure.children) {
                    if (child.children) {
                        for (const method of child.children) {
                            if (method.type === 'object') {
                                const methodKey = method.path.split('.').pop();
                                if (methodCount.hasOwnProperty(methodKey)) {
                                    methodCount[methodKey]++;
                                } else {
                                    methodCount.other++;
                                }
                            }
                        }
                    }
                }

                console.log('HTTP 方法分布:');
                Object.entries(methodCount).forEach(([method, count]) => {
                    console.log(`  ${method.toUpperCase()}: ${count}`);
                });
            }
        }

    } catch (error) {
        console.error('深度分析失败:', error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 示例5：统计信息
    console.log('📈 示例5：文件统计');
    try {
        console.log('生成文件统计信息...\n');

        const structure = await browser.analyzeStructure('./openapi.json');

        const stats = {
            totalSize: structure.size,
            totalKeys: 0,
            totalArrays: 0,
            totalObjects: 0,
            maxDepth: 0,
            estimatedItems: 0
        };

        // 递归计算统计信息
        const calculateStats = (node, depth = 0) => {
            stats.maxDepth = Math.max(stats.maxDepth, depth);

            switch (node.type) {
                case 'object':
                    stats.totalObjects++;
                    if (node.summary.keyCount) {
                        stats.totalKeys += node.summary.keyCount;
                    }
                    break;
                case 'array':
                    stats.totalArrays++;
                    if (node.summary.length) {
                        stats.estimatedItems += node.summary.length;
                    }
                    break;
            }

            if (node.children) {
                node.children.forEach(child => calculateStats(child, depth + 1));
            }
        };

        calculateStats(structure);

        console.log('📊 JSON 文件统计:');
        console.log(`  📁 文件大小: ${(stats.totalSize / 1024).toFixed(2)} KB`);
        console.log(`  🔑 总键数: ${stats.totalKeys}`);
        console.log(`  📁 对象数: ${stats.totalObjects}`);
        console.log(`  📋 数组数: ${stats.totalArrays}`);
        console.log(`  📦 估计项目数: ${stats.estimatedItems}`);
        console.log(`  📏 最大深度: ${stats.maxDepth}`);
        console.log(`  📈 平均每对象键数: ${(stats.totalKeys / stats.totalObjects).toFixed(1)}`);

    } catch (error) {
        console.error('统计失败:', error);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ 所有示例执行完成！');
    console.log('\n💡 提示: 运行以下命令启动交互式浏览器:');
    console.log('   node interactive-browser.js openapi.json');
}

// 运行示例
runBrowserExample().catch(console.error);