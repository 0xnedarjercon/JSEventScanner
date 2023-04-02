const fs = require("fs");
const Web3 = require("web3");
const { promisify } = require("util");
const { Bar, Presets } = require("cli-progress"); // import cli-progress

let web3, contractAddresses, maxChunk, startBlock, endBlock, path, allData, eventSignaturesToAbi;
let shutdown = false;
process.on("SIGINT", async function () {
  console.log("Caught interrupt signal, saving data");
  fs.writeFileSync(path, JSON.stringify(allData, undefined, 4));
  shutdown = true;
  setTimeout(function () {
    console.log("Timed out waiting for cleanup, exiting forcefully...");
    process.exit(1);
  }, 5000);
  console.log("Saving current results...");
});
//"0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822"
//"0xcf2aa50876cdfbb541206f89af0ee78d44a2abf8d328e37fa4917f982149848a"
async function main() {
  var datetime = new Date();
  // prints date & time in YYYY-MM-DD format
  console.log("starting scan at:", datetime.toISOString().slice(0, 10), datetime.toISOString().slice(11, 19));
  readInputs();
  allData = initData(path);
  start = Math.max(startBlock, allData["lastBlock"]);
  end = endBlock;
  console.log("scanning from block", start, "to", end);
  let endChunk;
  if (end - start > maxChunk) {
    endChunk = start + maxChunk;
  } else {
    endChunk = end;
  }
  let startChunk = start;
  // create a progress bar
  const bar = new Bar({}, Presets.shades_classic);
  bar.start();
  const saveBackupInterval = setInterval(() => {
    fs.writeFileSync("./blockDataBackup.json", JSON.stringify(allData, undefined, 4));
  }, 10 * 60 * 1000); // save every 10 mins
  const saveDataInterval = setInterval(() => {
    fs.writeFileSync(path, JSON.stringify(allData, undefined, 4));
  }, 60 * 1000); // save every minute

  while (endChunk < end && !shutdown) {
    await getChunk(startChunk, endChunk);
    startChunk += maxChunk;
    endChunk += maxChunk;
    // update the progress bar
    bar.update(Math.floor(((endChunk - maxChunk - start) / (end - start)) * 100));
  }
  await getChunk(startChunk, endChunk);

  // stop the progress bar
  bar.stop();
  clearInterval(saveDataInterval); // stop saving the data
  clearInterval(saveBackupInterval); // stop saving the data
  fs.writeFileSync(path, JSON.stringify(allData, undefined, 4));
  datetime = new Date();
  console.log("completed scan at:", datetime.toISOString().slice(0, 10), datetime.toISOString().slice(11, 19));
}

async function getChunk(start, end) {
  topics = [Object.keys(eventSignaturesToAbi)];
  events = await web3.eth.getPastLogs({
    fromBlock: start,
    toBlock: end,
    address: contractAddresses,
    topics: topics,
  });
  for (const event of events) {
    if (!(event.blockNumber in allData)) allData[event.blockNumber] = {};
    const decodedData = web3.eth.abi.decodeLog(eventSignaturesToAbi[event.topics[0]]["inputs"], event.data, event.topics.slice(1));
    if (!(event.transactionHash in allData[event.blockNumber])) {
      allData[event.blockNumber][event.transactionHash] = {};
    }

    allData[event.blockNumber][event.transactionHash][event.transactionIndex] = decodedData;
    allData[event.blockNumber][event.transactionHash][event.transactionIndex]["address"] = event.address;
    allData[event.blockNumber][event.transactionHash][event.transactionIndex]["event"] = eventSignaturesToAbi[event.topics[0]]["name"];
  }
  allData["lastBlock"] = end;
}

function readInputs() {
  let rawdata = fs.readFileSync("./inputData.json");
  let data = JSON.parse(rawdata);
  web3 = new Web3(data["WEB3"]);
  contractAddresses = data["ADDRESSES"];
  maxChunk = data["MAXCHUNK"];
  const eventNames = data["EVENTNAMES"];
  ABI = data["ABI"];

  eventSignaturesToAbi = {};
  eventNames.forEach((eventName) => {
    const event = ABI.find((item) => item.name === eventName && item.type === "event");
    if (event) {
      const inputs = event.inputs.map((input) => input.type).join(",");
      const signature = web3.eth.abi.encodeEventSignature(`${event.name}(${inputs})`);
      eventSignaturesToAbi[signature] = event;
    }
  });
  startBlock = data["STARTBLOCK"];
  endBlock = data["ENDBLOCK"];
  let hashString = "";
  for (address in contractAddresses) {
    hashString += address;
  }
  for (signiature in Object.keys(eventSignaturesToAbi)) {
    hashString += signiature;
  }
  let hash = web3.utils.keccak256(hashString);
  path = `./data/blockData${startBlock}-${endBlock}Hash${hash}.json`;
}

function initData(path) {
  let allData;
  if (fs.existsSync(path)) {
    let rawdata = fs.readFileSync(path);
    allData = JSON.parse(rawdata);
    console.log(`existing file found: ${path}, continuing from block ${allData["lastBlock"]}`);
  } else {
    console.log(`no file found, creating ${path}`);
    allData = {};
    allData["lastBlock"] = 0;
    fs.writeFileSync(path, JSON.stringify(allData, undefined, 4));
  }
  if (allData["lastBlock"] === undefined) allData["lastBlock"] = 0;
  return allData;
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
