import AdvancedJSONParser from "./advanced-json-parser.js";

export default class AdvancedParserTester {
  constructor() {
    this.parser = new AdvancedJSONParser();
  }

  async testFile(filePath) {
    console.log(`\n=== 高级JSON解析测试: ${filePath} ===`);

    try {
      // 测试智能解析
      const result = await this.parser.smartParseJSON(filePath, {
        progressCallback: (processed, total) => {
          const progress = ((processed / total) * 100).toFixed(1);
          console.log(`处理进度: ${progress}% (${(processed / 1024).toFixed(2)} KB / ${(total / 1024).toFixed(2)} KB)`);
        }
      });

      console.log('\n=== 解析结果 ===');
      console.log(`✅ 成功: ${result.success}`);
      console.log(`📁 方法: ${result.method}`);
      console.log(`📏 文件大小: ${result.fileSizeKB} KB`);
      console.log(`🔑 推荐方法: ${result.recommendedMethod}`);

      if (result.success) {
        console.log(`📊 顶层键数量: ${result.topLevelKeys.length}`);
        console.log(`📋 前10个键: ${result.topLevelKeys.slice(0, 10).join(', ')}`);

        if (result.stats) {
          console.log('\n📈 统计信息:');
          console.log(`   - 总元素数: ${result.stats.totalElements || 'N/A'}`);
          console.log(`   - 最大深度: ${result.stats.maxDepth || result.stats.complexity?.depth || 'N/A'}`);
          console.log(`   - 密度: ${result.stats.complexity?.density?.toFixed(2) || 'N/A'}`);

          if (result.stats.complexity?.typeDistribution) {
            const types = result.stats.complexity.typeDistribution;
            console.log('   - 类型分布:');
            console.log(`     * 对象: ${types.objects || 0}`);
            console.log(`     * 数组: ${types.arrays || 0}`);
            console.log(`     * 字符串: ${types.strings || 0}`);
            console.log(`     * 数字: ${types.numbers || 0}`);
            console.log(`     * 布尔值: ${types.booleans || 0}`);
            console.log(`     * 空值: ${types.nulls || 0}`);
          }
        }

        if (result.deepAnalysis) {
          console.log('\n🔍 深度分析:');
          console.log(`   - 深层路径数: ${result.deepAnalysis.deepPaths?.length || 0}`);
          console.log(`   - 嵌套对象数: ${result.deepAnalysis.nestedObjects || 0}`);

          if (result.deepAnalysis.complexityPatterns) {
            const patterns = result.deepAnalysis.complexityPatterns;
            console.log('   - 复杂度模式:');
            console.log(`     * 高度嵌套: ${patterns.highlyNested || 0}`);
            console.log(`     * 大数组: ${patterns.largeArrays || 0}`);
            console.log(`     * 混合类型: ${patterns.mixedTypes || 0}`);
            console.log(`     * 复杂对象: ${patterns.complexObjects || 0}`);
          }
        }

        // 显示结构样本
        if (result.structure && Object.keys(result.structure).length > 0) {
          console.log('\n🏗️  结构样本 (前5个):');
          Object.entries(result.structure).slice(0, 5).forEach(([key, info]) => {
            console.log(`   - ${key}: ${info.type}`);
            if (info.count !== undefined) {
              console.log(`     数量: ${info.count}`);
            }
            if (info.elementTypes) {
              console.log(`     元素类型: ${Object.keys(info.elementTypes).join(', ')}`);
            }
          });
        }

      } else {
        console.log(`❌ 失败原因: ${result.error}`);
      }

      return result;

    } catch (error) {
      console.error(`❌ 测试失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async testAllFiles() {
    const files = [
      './test-output.json',
      './large-example.json',
      './openapi.json'
    ];

    const results = [];

    for (const file of files) {
      const result = await this.testFile(file);
      results.push({ file, result });
    }

    // 汇总报告
    console.log('\n\n=== 测试汇总报告 ===');
    console.log(`测试文件数: ${files.length}`);
    console.log(`成功解析: ${results.filter(r => r.result.success).length}`);
    console.log(`失败解析: ${results.filter(r => !r.result.success).length}`);

    results.forEach(({ file, result }) => {
      console.log(`\n📄 ${file}:`);
      console.log(`   状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);
      console.log(`   方法: ${result.method}`);
      console.log(`   顶层键: ${result.success ? result.topLevelKeys.length : 'N/A'}`);
      console.log(`   文件大小: ${result.fileSizeKB} KB`);
    });

    return results;
  }
}

// 如果直接运行此文件，执行测试
if (import.meta.main) {
  const tester = new AdvancedParserTester();
  tester.testAllFiles();
}