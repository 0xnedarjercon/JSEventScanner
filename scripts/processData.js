const fs = require("fs");

function main() {
  path = "./blockData53076861-53078861Hash0x0c2cee5af6f22b1cc67c17b7824ea89a59f603935dc11fb5c679d5ab5ae12cef.json";
  let rawdata = fs.readFileSync(path);
  allData = JSON.parse(rawdata);
  processedData = {};
  console.log(allData);
  for (const [blockNum, blockdata] of Object.entries(allData)) {
    for (const [txHash, txData] of Object.entries(blockdata)) {
      for (const [eventIndex, eventData] of Object.entries(txData)) {
        if (eventData["event" == "Sync"]) {
          //process data here
        }
      }
    }
  }
}

main();
