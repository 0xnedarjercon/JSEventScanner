# JSEventScanner

inspired from python eventscanner from web3.py docs: https://web3py.readthedocs.io/en/stable/examples.html  
Special thanks to Chat-GPT :)

to run:  
npm i  
configure inputData.json as needed  
npx node .\scripts\eventscanner.js

everything is configured via the inputData JSON file:

WEB3: your the rpc URL  
STARTBLOCK: the first block you wish to scan  
ENDBLOCK: the last block to scan  
MAXCHUNK: the maximum number of blocks you can scan in 1 request  
EVENTNAMES: names of the events you want to check, must match the ABI "name" field  
"ABI": ABI's for the contracts you want to scan for  
"ADDRESSES": The contract addresses which emit the events

This example scans for all Sync and Swap events for a list of Uniswap pairs.

scans in chunks of MAXCHUNK until all specified blocks are scanned and stores them in ./Data/BlockData{start}-{end}Hash:{Hash of addresses and event signiatures for a unique identifier}  
periodically autosaves  
saves on Ctrl+C interupt

post processing can then be done on the output file
