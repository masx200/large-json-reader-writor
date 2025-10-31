import LargeJSONHandler from "./index.js";

async function runExample() {
  const jsonHandler = new LargeJSONHandler();

  // 示例1：下载并处理大型JSON文件
  try {
    console.log("=== 示例1：下载大型JSON文件 ===");

    // 下载文件
    await jsonHandler.downloadJSON(
      "http://localhost:8000/openapi.json",
      "./openapi.json",
    );

    console.log("\n=== 示例2：分块读取JSON文件 ===");

    // 分块读取文件
    let chunkCount = 0;
    for await (
      const { chunk, position, progress } of jsonHandler.readJSONInChunks(
        "./openapi.json",
        {
          chunkSize: 300, // 更小的块大小用于演示
          pretty: true,
          progressCallback: (pos, total) => {
            console.log(`读取进度: ${Math.round((pos / total) * 100)}%`);
          },
        },
      )
    ) {
      chunkCount++;
      console.log(`\n--- 块 ${chunkCount} (${progress}%) ---`);
      console.log("内容片段:");
      console.log(chunk.substring(0, 200) + "..."); // 只显示前200个字符

      // 如果只想处理前几个块作为示例
      if (chunkCount >= 3) {
        console.log("（示例只显示前3个块）");
        break;
      }
    }

    console.log("\n=== 示例3：创建并写入大型JSON文件 ===");

    // 创建一个大型JSON对象作为示例
    const largeData = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        value: Math.random() * 1000,
        timestamp: new Date().toISOString(),
        metadata: {
          category: ["A", "B", "C"][i % 3],
          tags: [`tag${i}`, `tag${i + 1}`, `tag${i + 2}`],
          score: Math.random(),
        },
      })),
      metadata: {
        totalItems: 1000,
        generatedAt: new Date().toISOString(),
        version: "1.0.0",
      },
    };

    // 分块写入文件
    await jsonHandler.writeJSONInChunks("./large-example.json", largeData, {
      chunkSize: 500,
      pretty: true,
    });

    console.log("\n=== 示例4：处理和修改现有JSON文件 ===");

    // 读取文件并统计信息
    const stats = {
      totalChunks: 0,
      totalSize: 0,
      containsArray: false,
      containsObject: false,
    };

    for await (
      const { chunk } of jsonHandler.readJSONInChunks("./large-example.json", {
        chunkSize: 500,
      })
    ) {
      stats.totalChunks++;
      stats.totalSize += chunk.length;

      if (chunk.includes("[")) stats.containsArray = true;
      if (chunk.includes("{")) stats.containsObject = true;
    }

    console.log("文件统计:");
    console.log(`- 总块数: ${stats.totalChunks}`);
    console.log(`- 总大小: ${(stats.totalSize / 1024).toFixed(2)} KB`);
    console.log(`- 包含数组: ${stats.containsArray}`);
    console.log(`- 包含对象: ${stats.containsObject}`);

    console.log("\n所有示例执行完成！");
  } catch (error) {
    console.error("示例执行失败:", error);
  }
}

// 运行示例
runExample();
