import fs from "fs";

console.log("开始合并JSON文件...");

try {
  const files = fs.readdirSync(".");
  console.log(`目录中的文件数量: ${files.length}`);

  const jsonFiles = files.filter((file) =>
    file.endsWith(".json") && file !== "merged_output.json"
  );
  console.log(`JSON文件数量: ${jsonFiles.length}`);
  console.log(`JSON文件列表: ${jsonFiles.join(", ")}`);

  const mergedData = {};

  jsonFiles.forEach((file) => {
    try {
      console.log(`正在处理: ${file}`);
      const content = fs.readFileSync(file, "utf8");
      const parsedContent = JSON.parse(content);
      const key = file.replace(".json", "");
      mergedData[key] = parsedContent;
      console.log(`成功处理: ${file}`);
    } catch (error) {
      console.error(`处理失败: ${file} - ${error.message}`);
    }
  });

  console.log(`合并后的键数量: ${Object.keys(mergedData).length}`);

  // 写入输出文件
  fs.writeFileSync(
    "merged_output.json",
    JSON.stringify(mergedData, null, 2),
    "utf8",
  );
  console.log("合并完成！输出文件: merged_output.json");
} catch (error) {
  console.error("程序出错:", error.message);
}
