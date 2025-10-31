import StreamJSONParser from "./stream-json-parser.js";

export default class StreamJSONParserTester {
  constructor() {
    this.parser = new StreamJSONParser();
  }

  async testFile(filePath) {
    console.log(`\n=== Stream-JSON解析测试: ${filePath} ===`);

    try {
      // 基础智能解析
      const result = await this.parser.smartParse(filePath, {
        chunkSize: 1024 * 20, // 20KB
        targetArray: "items",
        targetPaths: ["info", "paths", "components"],
        enableDeepAnalysis: true,
        progressCallback: (processed, total, progress) => {
          console.log(
            `处理进度: ${progress}% (${(processed / 1024).toFixed(2)} KB / ${
              (total / 1024).toFixed(2)
            } KB)`,
          );
        },
      });

      console.log("\n=== 解析结果 ===");
      console.log(`✅ 成功: ${result.success}`);
      console.log(`📁 方法: ${result.method}`);
      console.log(`📏 文件大小: ${result.fileSizeKB} KB`);
      console.log(`🎯 推荐方法: ${result.summary?.recommendedMethod || "N/A"}`);

      if (result.success) {
        // 基础解析结果
        if (result.results?.basic) {
          const basic = result.results.basic;
          console.log(`\n🔑 基础解析结果:`);
          console.log(`   - 方法: ${basic.method}`);
          console.log(`   - 顶层键: ${basic.stats?.topLevelKeyCount || 0}`);

          if (basic.topLevelKeys && basic.topLevelKeys.length > 0) {
            console.log(
              `   - 前10个键: ${basic.topLevelKeys.slice(0, 10).join(", ")}`,
            );
          }

          if (basic.stats?.typeDistribution) {
            const types = basic.stats.typeDistribution;
            console.log("   - 类型分布:");
            Object.entries(types).forEach(([type, count]) => {
              console.log(`     * ${type}: ${count}`);
            });
          }

          if (basic.structure && Object.keys(basic.structure).length > 0) {
            console.log("\n🏗️ 结构样本 (前5个):");
            Object.entries(basic.structure).slice(0, 5).forEach(
              ([key, info]) => {
                console.log(`   - ${key}: ${info.type}`);
                if (info.count !== undefined) {
                  console.log(`     数量: ${info.count}`);
                }
                if (info.sample) {
                  console.log(`     样本: "${info.sample}"`);
                }
              },
            );
          }
        }

        // 数组解析结果
        if (result.results?.array) {
          const array = result.results.array;
          console.log(`\n📋 数组解析结果 (${array.targetArray}):`);
          console.log(`   - 元素数: ${array.stats?.totalElements || 0}`);

          if (array.elements && array.elements.length > 0) {
            console.log("   - 前5个元素:");
            array.elements.slice(0, 5).forEach((element, index) => {
              console.log(`     ${index + 1}. 类型: ${element.type}`);
              if (element.data && element.data.name) {
                console.log(`       名称: ${element.data.name}`);
              }
            });
          }

          if (array.stats?.elementTypes) {
            console.log("   - 元素类型分布:");
            Object.entries(array.stats.elementTypes).forEach(
              ([type, count]) => {
                console.log(`     * ${type}: ${count}`);
              },
            );
          }
        }

        // 深度路径解析结果
        if (result.results?.deepPaths) {
          const deepPaths = result.results.deepPaths;
          console.log(`\n🔍 深度路径解析结果:`);
          console.log(`   - 路径数: ${deepPaths.stats?.totalPaths || 0}`);
          console.log(`   - 最大深度: ${deepPaths.stats?.maxDepthFound || 0}`);

          if (deepPaths.deepPaths && deepPaths.deepPaths.length > 0) {
            console.log("   - 深层路径样本:");
            deepPaths.deepPaths
              .filter((p) => p.depth >= 2)
              .slice(0, 8)
              .forEach((p, index) => {
                console.log(
                  `     ${
                    index + 1
                  }. ${p.path} (深度: ${p.depth}, 类型: ${p.type})`,
                );
                console.log(`       值: ${p.value}`);
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
      "./test-output.json",
      "./large-example.json",
      "./openapi.json",
    ];

    const results = [];

    for (const file of files) {
      const result = await this.testFile(file);
      results.push({ file, result });
    }

    // 汇总报告
    console.log("\n\n=== Stream-JSON解析测试汇总报告 ===");
    console.log(`测试文件数: ${files.length}`);
    console.log(`成功解析: ${results.filter((r) => r.result.success).length}`);
    console.log(`失败解析: ${results.filter((r) => !r.result.success).length}`);

    console.log("\n📄 详细结果:");
    results.forEach(({ file, result }) => {
      const status = result.success ? "✅" : "❌";
      const method = result.method || "N/A";
      const basicSuccess = result.results?.basic?.success || false;
      const arraySuccess = result.results?.array?.success || false;
      const deepSuccess = result.results?.deepPaths?.success || false;
      const keyCount = result.results?.basic?.topLevelKeys?.length || 0;

      console.log(
        `${status} ${file} | ${method} | 基础:${basicSuccess} | 数组:${arraySuccess} | 深度:${deepSuccess} | ${keyCount} keys`,
      );
    });

    return results;
  }
}

// 如果直接运行此文件，执行测试
if (import.meta.main) {
  const tester = new StreamJSONParserTester();
  tester.testAllFiles();
}
