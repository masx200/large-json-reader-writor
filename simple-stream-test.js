import streamChain from "stream-chain";
import streamJson from "stream-json";
import streamValuesModule from "stream-json/streamers/StreamValues.js";
import fs from "fs";

// Simple test of stream-json
async function testStreamJSON() {
  const filePath = "./test-output.json";

  console.log("Testing stream-json with:", filePath);

  const pipeline = streamChain.chain([
    fs.createReadStream(filePath),
    streamJson.parser(),
    new streamValuesModule(),
  ]);

  let count = 0;

  pipeline.on("data", (data) => {
    count++;
    console.log(`Data ${count}:`, data);
  });

  pipeline.on("end", () => {
    console.log(`✅ Processing complete. Total items: ${count}`);
  });

  pipeline.on("error", (error) => {
    console.error("❌ Error:", error);
  });
}

// Run the test
testStreamJSON().catch(console.error);
