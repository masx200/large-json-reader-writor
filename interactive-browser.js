import JSONStructureBrowser from "./json-browser.js";
import readline from "readline";

class InteractiveJSONBrowser {
  constructor() {
    this.browser = new JSONStructureBrowser();
    this.currentPath = "";
    this.currentFile = "";
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * 启动交互式浏览器
   */
  async start(filePath) {
    this.currentFile = filePath;
    console.log("\n=== JSON 结构交互式浏览器 ===");
    console.log("帮助命令: help, quit, cd, ls, pwd, search, info\n");

    await this.displayRootStructure();

    // 主循环
    while (true) {
      try {
        const answer = await this.question(`${this.getPrompt()}> `);
        await this.processCommand(answer);
      } catch (error) {
        if (error.message === "退出") {
          break;
        }
        console.error(`错误: ${error.message}`);
      }
    }

    this.rl.close();
    console.log("再见！");
  }

  /**
   * 显示根结构
   */
  async displayRootStructure() {
    const structure = await this.browser.analyzeStructure(this.currentFile);
    console.log("\n📁 JSON 文件结构:");
    console.log(`📊 文件大小: ${(structure.size / 1024 / 1024).toFixed(2)} MB`);
    console.log("📋 根结构:");
    console.log(this.browser.displayStructure(structure));
  }

  /**
   * 处理用户命令
   */
  async processCommand(command) {
    const cmd = command.trim().toLowerCase();
    const parts = command.trim().split(" ");

    switch (cmd) {
      case "":
        break;

      case "help":
      case "h":
        this.showHelp();
        break;

      case "quit":
      case "q":
      case "exit":
        throw new Error("退出");

      case "pwd":
        console.log(`当前路径: ${this.currentPath || "/"}`);
        break;

      case "ls":
        await this.listCurrentPath();
        break;

      case "info":
        await this.showCurrentInfo();
        break;

      default:
        if (cmd.startsWith("cd ")) {
          const targetPath = command.substring(3).trim();
          await this.changeDirectory(targetPath);
        } else if (cmd.startsWith("search ")) {
          const searchTerm = command.substring(7).trim();
          await this.searchInFile(searchTerm);
        } else if (cmd.startsWith("cat ")) {
          const targetPath = command.substring(4).trim();
          await this.showContentAtPath(targetPath);
        } else if (cmd.startsWith("tree")) {
          const depth = parseInt(command.substring(5).trim()) || 2;
          await this.showTree(depth);
        } else {
          console.log(`未知命令: ${cmd}。输入 'help' 查看帮助。`);
        }
    }
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log("\n📚 命令帮助:");
    console.log("  help, h         - 显示帮助信息");
    console.log("  quit, q, exit   - 退出浏览器");
    console.log("  pwd             - 显示当前路径");
    console.log("  ls              - 列出当前路径的内容");
    console.log("  cd <path>       - 导航到指定路径");
    console.log("  cat <path>      - 显示指定路径的内容");
    console.log("  search <term>   - 搜索键或值");
    console.log("  info            - 显示当前路径的详细信息");
    console.log("  tree [depth]    - 显示树状结构 (默认深度: 2)");
    console.log("\n🔍 路径示例:");
    console.log("  cd info          - 导航到根对象的 info 属性");
    console.log("  cd paths[0]      - 导航到 paths 数组的第一个元素");
    console.log("  cd info.title    - 导航到 info 对象的 title 属性");
    console.log("  cd ..            - 返回上一级");
    console.log("  cd /             - 返回根路径");
  }

  /**
   * 获取当前提示符
   */
  getPrompt() {
    return `📁${this.currentPath || "/"}`;
  }

  /**
   * 列出当前路径内容
   */
  async listCurrentPath() {
    try {
      if (!this.currentPath) {
        await this.displayRootStructure();
        return;
      }

      const structure = await this.browser.navigateToPath(
        this.currentFile,
        this.currentPath,
      );
      if (structure) {
        console.log(`\n📁 ${this.currentPath}:`);
        console.log(this.browser.displayStructure(structure));
      } else {
        console.log("路径不存在或无法访问");
      }
    } catch (error) {
      console.error(`列出失败: ${error.message}`);
    }
  }

  /**
   * 切换目录
   */
  async changeDirectory(targetPath) {
    try {
      if (targetPath === "..") {
        // 返回上级目录
        this.currentPath = this.getParentPath(this.currentPath);
      } else if (targetPath === "/") {
        // 返回根目录
        this.currentPath = "";
      } else if (targetPath.startsWith("/")) {
        // 绝对路径
        this.currentPath = targetPath.substring(1);
      } else {
        // 相对路径
        this.currentPath = this.currentPath
          ? `${this.currentPath}.${targetPath}`
          : targetPath;
      }

      // 验证路径是否存在
      const structure = await this.browser.navigateToPath(
        this.currentFile,
        this.currentPath,
      );
      if (!structure) {
        console.log(`路径不存在: ${targetPath}`);
        this.currentPath = this.getParentPath(this.currentPath);
        return;
      }

      console.log(`✅ 已切换到: ${this.currentPath || "/"}`);

      // 自动列出内容
      await this.listCurrentPath();
    } catch (error) {
      console.error(`切换目录失败: ${error.message}`);
    }
  }

  /**
   * 显示指定路径的内容
   */
  async showContentAtPath(targetPath) {
    try {
      let fullPath = targetPath;
      if (!targetPath.startsWith("/")) {
        fullPath = this.currentPath
          ? `${this.currentPath}.${targetPath}`
          : targetPath;
      } else {
        fullPath = targetPath.substring(1);
      }

      const structure = await this.browser.navigateToPath(
        this.currentFile,
        fullPath,
      );
      if (structure) {
        console.log(`\n📄 ${fullPath}:`);
        console.log(this.browser.displayStructure(structure));

        // 如果是简单类型，显示完整内容
        if (["string", "number", "boolean", "null"].includes(structure.type)) {
          console.log(
            `\n💾 完整内容: ${JSON.stringify(structure.summary.value)}`,
          );
        }
      } else {
        console.log("路径不存在");
      }
    } catch (error) {
      console.error(`显示内容失败: ${error.message}`);
    }
  }

  /**
   * 显示当前路径信息
   */
  async showCurrentInfo() {
    try {
      const structure = await this.browser.navigateToPath(
        this.currentFile,
        this.currentPath,
      );
      if (structure) {
        console.log(`\n📊 路径信息: ${this.currentPath || "/"}`);
        console.log(`  类型: ${structure.type}`);

        if (structure.type === "object") {
          console.log(`  键数量: ${structure.summary.keyCount}`);
          console.log(
            `  键列表: ${structure.summary.keys.slice(0, 10).join(", ")}${
              structure.summary.keys.length > 10 ? "..." : ""
            }`,
          );
        } else if (structure.type === "array") {
          console.log(`  数组长度: ${structure.summary.length}`);
          console.log(`  元素类型: ${structure.summary.type}`);
        } else if (
          structure.type !== "ellipsis" &&
          structure.type !== "partial"
        ) {
          console.log(`  值: ${structure.summary.value}`);
        }
      } else {
        console.log("当前路径不存在");
      }
    } catch (error) {
      console.error(`获取信息失败: ${error.message}`);
    }
  }

  /**
   * 搜索文件
   */
  async searchInFile(searchTerm) {
    try {
      console.log(`🔍 搜索 "${searchTerm}"...`);
      const results = await this.browser.search(this.currentFile, searchTerm);

      if (results.length === 0) {
        console.log("未找到匹配项");
        return;
      }

      console.log(`\n📋 找到 ${results.length} 个匹配项:`);
      results.slice(0, 20).forEach((result, index) => {
        const icon = result.type === "key" ? "🔑" : "💎";
        console.log(`${index + 1}. ${icon} ${result.value} (${result.type})`);
      });

      if (results.length > 20) {
        console.log(`... 还有 ${results.length - 20} 个结果未显示`);
      }
    } catch (error) {
      console.error(`搜索失败: ${error.message}`);
    }
  }

  /**
   * 显示树状结构
   */
  async showTree(maxDepth = 2) {
    try {
      console.log("🌳 显示树状结构...\n");

      const structure = await this.browser.analyzeStructure(this.currentFile);
      await this.displayTreeRecursive(structure, 0, maxDepth);
    } catch (error) {
      console.error(`显示树状结构失败: ${error.message}`);
    }
  }

  /**
   * 递归显示树状结构
   */
  async displayTreeRecursive(structure, currentDepth, maxDepth) {
    if (currentDepth >= maxDepth) {
      return;
    }

    const indent = "  ".repeat(currentDepth);

    switch (structure.type) {
      case "object":
        console.log(`${indent}📁 Object (${structure.summary.keyCount} keys)`);
        if (structure.summary.keys) {
          structure.summary.keys.slice(0, 5).forEach((key) => {
            console.log(`${indent}  ├── ${key}`);
          });
          if (structure.summary.keys.length > 5) {
            console.log(
              `${indent}  └── ... 还有 ${
                structure.summary.keys.length - 5
              } 个键`,
            );
          }
        }
        break;

      case "array":
        console.log(
          `${indent}📋 Array (${structure.summary.length} items, type: ${structure.summary.type})`,
        );
        structure.children.slice(0, 3).forEach((child, index) => {
          console.log(`${indent}  ├── [${index}] ${child.type}`);
        });
        if (structure.summary.length > 3) {
          console.log(
            `${indent}  └── ... 还有 ${structure.summary.length - 3} 个元素`,
          );
        }
        break;

      default:
        console.log(
          `${indent}${structure.type}: ${
            structure.summary.display || structure.summary.value
          }`,
        );
    }
  }

  /**
   * 获取父路径
   */
  getParentPath(path) {
    if (!path) return "";

    const lastDot = path.lastIndexOf(".");
    const lastBracket = path.lastIndexOf("[");
    const cutIndex = Math.max(lastDot, lastBracket);

    return cutIndex > 0 ? path.substring(0, cutIndex) : "";
  }

  /**
   * 提问用户
   */
  question(query) {
    return new Promise((resolve) => {
      this.rl.question(query, (answer) => {
        resolve(answer);
      });
    });
  }
}

// 导出模块
export default InteractiveJSONBrowser;

// 如果直接运行此文件
if (import.meta.main) {
  const browser = new InteractiveJSONBrowser();

  // 检查命令行参数
  const filePath = process.argv[2];
  if (!filePath) {
    console.log("用法: node interactive-browser.js <json文件路径>");
    console.log("示例: node interactive-browser.js openapi.json");
    process.exit(1);
  }

  // 启动交互式浏览器
  browser.start(filePath).catch(console.error);
}
