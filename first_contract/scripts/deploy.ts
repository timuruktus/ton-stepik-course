
import { address, toNano } from "@ton/core";
import { MainContract } from "../wrappers/MainContract";
import { compile, NetworkProvider } from "@ton/blueprint";

export async function run(provider: NetworkProvider) {
  const myContract = MainContract.createFromConfig(
    {
      counter: 0,
      recent_sender: address("0QD9jGNwJs3Sv5y1OWNIq_jXxWqrGi8q10zLIB3SZwdak7Nt"),
      owner_address: address("0QD9jGNwJs3Sv5y1OWNIq_jXxWqrGi8q10zLIB3SZwdak7Nt"),
    },
    await compile("MainContract")
  );

  const openedContract = provider.open(myContract);

  openedContract.sendDeploy(provider.sender(), toNano("0.05"));

  await provider.waitForDeploy(myContract.address);
}
