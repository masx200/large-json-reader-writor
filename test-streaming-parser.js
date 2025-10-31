import StreamingJSONParser from "./streaming-json-parser.js";

export default class StreamingParserTester {
  constructor() {
    this.parser = new StreamingJSONParser();
  }

  async testFile(filePath) {
    console.log(`\n=== 流式JSON解析测试: ${filePath} ===`);

    try {
      const stats = await import('fs').then(fsModule => fsModule.statSync(filePath));
      const fileSizeKB = stats.size / 1024;

      console.log(`文件大小: ${fileSizeKB.toFixed(2)} KB`);

      // 测试智能解析
      const result = await this.parser.smartParse(filePath, {
        chunkSize: 1024 * 20, // 20KB
        maxDepth: 5,
        progressCallback: (processed, total) => {
          const progress = ((processed / total) * 100).toFixed(1);
          console.log(`处理进度: ${progress}%`);
        }
      });

      console.log('\n=== 解析结果 ===');
      console.log(`✅ 成功: ${result.success}`);
      console.log(`📁 方法: ${result.method}`);
      console.log(`📏 文件大小: ${result.fileSizeKB} KB`);
      console.log(`🎯 推荐方法: ${result.recommendedMethod}`);

      if (result.success) {
        console.log(`🔑 顶层键数量: ${result.stats?.topLevelKeyCount || result.topLevelKeys?.length || 0}`);

        if (result.topLevelKeys && result.topLevelKeys.length > 0) {
          console.log(`📋 前10个顶层键:`);
          result.topLevelKeys.slice(0, 10).forEach((key, index) => {
            console.log(`   ${index + 1}. ${key}`);
          });
        }

        if (result.stats) {
          console.log('\n📊 统计信息:');
          console.log(`   - 最大深度: ${result.stats.maxDepth || 'N/A'}`);
          console.log(`   - 总元素数: ${result.stats.totalElements || 'N/A'}`);

          if (result.stats.typeDistribution) {
            const types = result.stats.typeDistribution;
            console.log('   - 类型分布:');
            Object.entries(types).forEach(([type, count]) => {
              console.log(`     * ${type}: ${count}`);
            });
          }
        }

        if (result.structure && Object.keys(result.structure).length > 0) {
          console.log('\n🏗️  结构样本 (前5个):');
          Object.entries(result.structure).slice(0, 5).forEach(([path, info]) => {
            console.log(`   - ${path}: ${info.type} ${info.count ? `(x${info.count})` : ''}`);
            if (info.samples && info.samples.length > 0) {
              console.log(`     样本: "${info.samples[0]}"${info.samples.length > 1 ? '...' : ''}`);
            }
          });
        }

        // 深度解析结果
        if (result.deepPaths) {
          console.log('\n🔍 深度路径分析:');
          console.log(`   - 发现路径数: ${result.deepPaths.length}`);
          console.log(`   - 最大深度: ${result.stats?.maxDepthFound || 'N/A'}`);

          const deepPaths = result.deepPaths.filter(p => p.depth >= 3);
          if (deepPaths.length > 0) {
            console.log('   - 深层路径样本:');
            deepPaths.slice(0, 5).forEach(p => {
              console.log(`     * ${p.path} (深度: ${p.depth})`);
            });
          }
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

    console.log('\n📄 详细结果:');
    results.forEach(({ file, result }) => {
      const status = result.success ? '✅' : '❌';
      const method = result.method || 'N/A';
      const keyCount = result.success ? (result.stats?.topLevelKeyCount || result.topLevelKeys?.length || 0) : 'N/A';
      console.log(`${status} ${file} | ${method} | ${keyCount} keys | ${result.fileSizeKB} KB`);
    });

    return results;
  }
}

// 如果直接运行此文件，执行测试
if (import.meta.main) {
  const tester = new StreamingParserTester();
  tester.testAllFiles();
}