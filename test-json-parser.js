import fs from "fs/promises";

export default class JSONParserTester {
  constructor() {
    this.results = {};
  }

  async testFile(filePath) {
    console.log(`\n=== 测试文件: ${filePath} ===`);

    try {
      const content = await fs.readFile(filePath, "utf8");
      const first5KB = content.substring(0, 5000);
      const first50KB = content.substring(0, 50000);

      console.log(`文件大小: ${(content.length / 1024).toFixed(2)} KB`);
      console.log(`测试内容长度(5KB): ${first5KB.length} 字符`);
      console.log(`测试内容长度(50KB): ${first50KB.length} 字符`);

      // 方法1: 直接解析5KB
      console.log("\n方法1: 直接解析前5KB");
      try {
        const data = JSON.parse(first5KB);
        console.log(`✅ 成功! 顶层键数量: ${Object.keys(data).length}`);
        console.log(`前5个键: ${Object.keys(data).slice(0, 5).join(", ")}`);
      } catch (e) {
        console.log(`❌ 失败: ${e.message}`);
      }

      // 方法1a: 直接解析50KB
      console.log("\n方法1a: 直接解析前50KB");
      try {
        const data = JSON.parse(first50KB);
        console.log(`✅ 成功! 顶层键数量: ${Object.keys(data).length}`);
        console.log(`前5个键: ${Object.keys(data).slice(0, 5).join(", ")}`);
      } catch (e) {
        console.log(`❌ 失败: ${e.message}`);
      }

      // 方法2: 查找完整对象(50KB)
      console.log("\n方法2: 查找完整JSON对象(50KB)");
      const firstObjStart = first50KB.indexOf("{");
      if (firstObjStart !== -1) {
        let braceCount = 0;
        let firstObjEnd = -1;

        for (let i = firstObjStart; i < first50KB.length; i++) {
          const char = first50KB[i];
          if (char === "{") {
            braceCount++;
          } else if (char === "}") {
            braceCount--;
            if (braceCount === 0) {
              firstObjEnd = i + 1;
              break;
            }
          }
        }

        if (firstObjEnd !== -1) {
          const firstObject = first50KB.substring(firstObjStart, firstObjEnd);
          try {
            const data = JSON.parse(firstObject);
            console.log(`✅ 成功! 对象长度: ${firstObject.length} 字符`);
            console.log(`顶层键数量: ${Object.keys(data).length}`);
            console.log(`前5个键: ${Object.keys(data).slice(0, 5).join(", ")}`);
          } catch (e) {
            console.log(`❌ 解析失败: ${e.message}`);
            console.log(`提取的对象: ${firstObject.substring(0, 100)}...`);
          }
        } else {
          console.log(`❌ 找不到完整对象结束位置`);
        }
      } else {
        console.log(`❌ 找不到JSON对象开始位置`);
      }

      // 方法3: 查找平衡JSON(50KB)
      console.log("\n方法3: 查找平衡JSON结构(50KB)");
      const balancedJson = this.findBalancedJSON(first50KB);
      if (balancedJson) {
        try {
          const data = JSON.parse(balancedJson);
          console.log(`✅ 成功! 平衡JSON长度: ${balancedJson.length} 字符`);
          console.log(`顶层键数量: ${Object.keys(data).length}`);
          console.log(`前5个键: ${Object.keys(data).slice(0, 5).join(", ")}`);
        } catch (e) {
          console.log(`❌ 解析失败: ${e.message}`);
          console.log(`平衡JSON: ${balancedJson.substring(0, 100)}...`);
        }
      } else {
        console.log(`❌ 找不到平衡JSON结构`);
      }

      // 显示文件前200个字符
      console.log("\n文件前200个字符:");
      console.log(content.substring(0, 200) + "...");
    } catch (error) {
      console.error(`测试失败: ${error.message}`);
    }
  }

  findBalancedJSON(text) {
    let startIdx = -1;
    let endIdx = -1;
    let braceCount = 0;
    let bracketCount = 0;

    // 查找JSON开始位置
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === "{" || char === "[") {
        startIdx = i;
        braceCount = char === "{" ? 1 : 0;
        bracketCount = char === "[" ? 1 : 0;
        break;
      }
    }

    if (startIdx === -1) return null;

    // 查找对应的结束位置
    for (let i = startIdx + 1; i < text.length; i++) {
      const char = text[i];
      if (char === "{") {
        braceCount++;
      } else if (char === "}") {
        braceCount--;
      } else if (char === "[") {
        bracketCount++;
      } else if (char === "]") {
        bracketCount--;
      }

      if (braceCount === 0 && bracketCount === 0) {
        endIdx = i + 1;
        break;
      }
    }

    if (endIdx === -1) return null;

    return text.substring(startIdx, endIdx);
  }

  async testAllFiles() {
    const files = [
      "./test-output.json",
      "./large-example.json",
      "./openapi.json",
    ];

    for (const file of files) {
      await this.testFile(file);
    }
  }
}

// 如果直接运行此文件，执行测试
if (import.meta.main) {
  const tester = new JSONParserTester();
  tester.testAllFiles();
}
