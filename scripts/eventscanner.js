const fs = require("fs");
const Web3 = require("web3");
const { promisify } = require("util");
const JSONStream = require("JSONStream");
const { Bar, Presets } = require("cli-progress"); // import cli-progress

console.log("start");
let web3, contractAddresses, maxChunk, startBlock, endBlock, path, allData, eventSignaturesToAbi, lastBlock;
let shutdown = false;
process.on("SIGINT", async function () {
  console.log("Caught interrupt signal, saving data");
  appendData();
  shutdown = true;
  setTimeout(function () {
    console.log("Timed out waiting for cleanup, exiting forcefully...");
    process.exit(1);
  }, 10000);
  console.log("Saving current results...");
});

async function main() {
  var datetime = new Date();
  // prints date & time in YYYY-MM-DD format
  console.log("starting scan at:", datetime.toISOString().slice(0, 10), datetime.toISOString().slice(11, 19));
  readInputs();
  initData(path);
  start = Math.max(startBlock, lastBlock);
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
  const bar = new Bar(
    {
      format: "[{bar}] {percentage}% | ETA: {eta}s | {value}/{total}",
    },
    Presets.shades_classic
  );
  bar.start();
  const saveBackupInterval = setInterval(() => {
    fs.writeFileSync("./blockDataBackup.json", JSON.stringify(allData, undefined, 4));
  }, 10 * 60 * 1000); // save every 10 mins
  const saveDataInterval = setInterval(() => {
    appendData();
  }, 10 * 1000); // save every minute

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
  appendData();
  datetime = new Date();
  console.log("finished scan at:", datetime.toISOString().slice(0, 10), datetime.toISOString().slice(11, 19));
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
    allData[event.blockNumber][event.transactionHash][event.transactionIndex] = {};
    allData[event.blockNumber][event.transactionHash][event.transactionIndex]["event"] = eventSignaturesToAbi[event.topics[0]]["name"];
    allData[event.blockNumber][event.transactionHash][event.transactionIndex]["address"] = event.address;
    let count = 0;
    const totalValues = Object.keys(decodedData).length;
    for (const [key, value] of Object.entries(decodedData)) {
      if (count >= totalValues / 2) {
        allData[event.blockNumber][event.transactionHash][event.transactionIndex][key] = value;
      }
      count++;
    }
  }
  lastBlock = end;
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
  path = `./data/blockData${startBlock}-${endBlock}Hash${hash}`;
}

function initData(path) {
  allData = {};
  lastBlock = 0;
  if (!fs.existsSync(path + ".json")) {
    console.log(`no file found, creating ${path}`);
    allData["blocks"] = `${startBlock}-${endBlock}`;
    fs.writeFileSync(path + ".json", JSON.stringify(allData, undefined, 4));
  } else {
    rawData = fs.readFileSync(path + ".json");
    dataTmp = JSON.parse(rawData);
    keyList = Object.keys(dataTmp);
    lastBlock = keyList[keyList.length - 2];
    if (lastBlock === undefined) lastBlock = 0;
    console.log(`existing file found: ${path}.json, continuing from block ${lastBlock}`);
  }
}

async function appendData() {
  if (Object.keys(allData).length > 0) {
    const jsonString = JSON.stringify(allData, undefined, 4);
    const dataString = "," + jsonString.slice(1, jsonString.length - 1) + "}";

    // get the current file size
    const fileSize = fs.statSync(path + ".json").size;

    // append the new data to the end of the file
    fs.writeSync(fs.openSync(path + ".json", "r+"), dataString, fileSize - 1);
    // clear the allData object
  }
  allData = {};
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
