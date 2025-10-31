// ✅ Working Stream-JSON Example
// 这个示例展示了在ES Module中正确使用stream-json的方法

import streamChain from 'stream-chain';
import streamJson from 'stream-json';
import streamValuesModule from 'stream-json/streamers/StreamValues.js';
import fs from 'fs';

// 正确的模块导入和用法说明：
// 1. stream-chain 和 stream-json 是 CommonJS 模块，需要使用 default 导入
// 2. stream-json 的子模块也需要使用 default 导入
// 3. streamValues 是一个类，需要用 new 实例化

async function demonstrateStreamJSON() {
  const filePath = './test-output.json';

  console.log('🔍 Stream-JSON 工作示例');
  console.log('文件:', filePath);

  return new Promise((resolve, reject) => {
    // ✅ 正确的管道创建方法
    const pipeline = streamChain.chain([
      fs.createReadStream(filePath),
      streamJson.parser(),           // parser() 是一个工厂函数
      new streamValuesModule()       // streamValues 是一个类，需要 new
    ]);

    let dataCount = 0;
    const topLevelKeys = new Set();

    pipeline.on('data', (data) => {
      dataCount++;

      if (data && data.key && data.value !== undefined) {
        topLevelKeys.add(data.key);
      }

      console.log(`📦 数据项 ${dataCount}:`, {
        key: data.key,
        valueType: typeof data.value,
        hasValue: data.value !== undefined
      });
    });

    pipeline.on('end', () => {
      console.log('✅ 解析完成');
      console.log(`📊 处理了 ${dataCount} 个数据项`);
      console.log(`🔑 发现顶层键:`, Array.from(topLevelKeys));

      resolve({
        success: true,
        dataCount: dataCount,
        topLevelKeys: Array.from(topLevelKeys)
      });
    });

    pipeline.on('error', (error) => {
      console.error('❌ 解析错误:', error);
      reject(error);
    });
  });
}

// 运行示例
demonstrateStreamJSON()
  .then(result => {
    console.log('\n🎉 解析结果:', result);
  })
  .catch(error => {
    console.error('\n💥 执行失败:', error);
  });

export { demonstrateStreamJSON };