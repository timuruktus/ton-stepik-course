import { Address, Cell, beginCell, contractAddress, serializeTuple, toNano } from "@ton/core";
import { hex } from "../build/main.compiled.json";
import { getHttpV4Endpoint } from "@orbs-network/ton-access";
import { TonClient4 } from "@ton/ton";
import qs from "qs";
import qrcode from "qrcode-terminal";
import dotenv from "dotenv"

dotenv.config();

async function onchainTestScript() {
  const codeCell = Cell.fromBoc(Buffer.from(hex, "hex"))[0];
  const dataCell = beginCell().storeUint(0, 32).endCell();

  const address = contractAddress(0, {
    code: codeCell,
    data: dataCell,
  });

  const endpoint = await getHttpV4Endpoint({
    network: process.env.TESTNET ? "testnet": "mainnet",
  });
  const client4 = new TonClient4({ endpoint });

  const latestBlock = await client4.getLastBlock();
  let status = await client4.getAccount(latestBlock.last.seqno, address);

  if (status.account.state.type !== "active") {
    console.log("Contract is not active");
    return;
  }

  let link =
    `https://tonhub.com/transfer/` +
    address.toString({
      testOnly: process.env.TESTNET ? true : false,
    }) +
    "?" +
    qs.stringify({
      text: "Simple test transaction",
      amount: toNano(0.01).toString(10),
    });
    console.log("Contract address is : " + address.toString({
      testOnly: process.env.TESTNET ? true : false,
    }));
  qrcode.generate(link, { small: true }, (code) => {
    console.log(code);
  });

  test_getter_latest_address_and_total_sum(client4, address);
}

async function test_getter_latest_address_and_total_sum(client4:TonClient4, address:Address) {
  let recent_sender_archive: Address;
  let resent_sum = -1

  setInterval(async () => {
    const latestBlock = await client4.getLastBlock();
    const { exitCode, result } = await client4.runMethod(
      latestBlock.last.seqno,
      address,
      "get_contract_data"
    );
    

    if (exitCode !== 0) {
      console.log("Running getter method failed");
      return;
    }
    if (result[0].type !== "slice") {
      console.log("Not a slice type in result[0]");
      return;
    }
    if (result[1].type !== "int") {
      console.log("Not a int type in result[1]");
      return;
    }

    let result_slice = serializeTuple(result).beginParse();
    console.log(result);
    let most_recent_sender = result[0].cell.beginParse().loadAddress();
    console.log(most_recent_sender);
    
    let total_sum = Number(result[1].value);
    console.log(total_sum);

    if (
      (most_recent_sender &&
      most_recent_sender.toString() !== recent_sender_archive?.toString())
      || resent_sum !== total_sum
    ) {
      console.log(
        "Recent sender: " +
          most_recent_sender.toString({ testOnly: true, bounceable: false }) + ". New total sum = " + total_sum
      );
      recent_sender_archive = most_recent_sender;
      resent_sum = total_sum;
    }
    else{
      //console.log("Recent sender didn't change from last update. Current address is: " + most_recent_sender.toString({ testOnly: true }))
    }
  }, 2000);
}

onchainTestScript();