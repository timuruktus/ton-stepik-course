import { Cell, Address, beginCell, toNano } from "@ton/core";
import { hex } from "../build/main.compiled.json";
import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { MainContract } from "../wrappers/MainContract";
import "@ton/test-utils";
import { compile } from "@ton/blueprint";



describe("main.fc contract tests", () => {

    let blockchain: Blockchain;
    let ownerContract: SandboxContract<TreasuryContract>;
    let senderContract: SandboxContract<TreasuryContract>;
    let mainContract: SandboxContract<MainContract>;
    let codeCell: Cell;

    beforeAll(async () => {
      codeCell = await compile("MainContract");
    });

    beforeEach(async () => {
        
        blockchain = await Blockchain.create();
        ownerContract = await blockchain.treasury("contract owner");
        senderContract = await blockchain.treasury("sender");
        mainContract = blockchain.openContract(
            await MainContract.createFromConfig({
              counter: 0,
              recent_sender: ownerContract.address,
              owner_address: ownerContract.address
            }, codeCell)
          );
        
    });

    it("should send increment", async () => {
      const sentMessageResult = await mainContract.sendIncrement(senderContract.getSender(), toNano("0.1"), 1);

      expect(sentMessageResult.transactions).toHaveTransaction({
        from: senderContract.address,
        to: mainContract.address,
        success: true,
      });
    });

    it("should save recent sender address", async () => {
      const sentMessageResult = await mainContract.sendIncrement(senderContract.getSender(), toNano("0.1"), 1);
      const data = await mainContract.getContractData();
      expect(data.recent_sender.toString()).toBe(senderContract.address.toString());
    });

    it("should update counter", async () => {
      const sentMessageResult = await mainContract.sendIncrement(senderContract.getSender(), toNano("0.1"), 1);
      const data = await mainContract.getContractData();
      expect(data.number).toEqual(1)
    });

    it("owner address should stay the same", async () => {
      const sentMessageResult = await mainContract.sendIncrement(senderContract.getSender(), toNano("0.1"), 1);
      const data = await mainContract.getContractData();
      expect(data.owner_address.toString()).toBe(ownerContract.address.toString());
    });

    it("should deposit funds", async () => {
      const depositRequest = await mainContract.sendDeposit(senderContract.getSender(), toNano("5"));
      expect(depositRequest.transactions).toHaveTransaction({
        from: senderContract.address,
        to: mainContract.address,
        success: true,
      });
      const balance = await mainContract.getBalance();
      expect(balance.number).toBeGreaterThan(toNano("4.99"));
    });

    it("should not deposit funds without OPcode", async () => {
      const depositRequest = await mainContract.sendDepositWithoutOP(senderContract.getSender(), toNano("5"));
      expect(depositRequest.transactions).toHaveTransaction({
        from: senderContract.address,
        to: mainContract.address,
        success: false,
        exitCode: 35,
      });
      const balance = await mainContract.getBalance();
      expect(balance.number).toBe(0);
    });

    it("should not deposit funds with wrong OPcode", async () => {
      const depositRequest = await mainContract.sendDepositWithWrongOP(senderContract.getSender(), toNano("5"));
      expect(depositRequest.transactions).toHaveTransaction({
        from: senderContract.address,
        to: mainContract.address,
        success: false,
        exitCode: 777,
      });
      const balance = await mainContract.getBalance();
      expect(balance.number).toBe(0);
    });

    it("should withdraw funds, less than contract balance", async () => {
      await mainContract.sendDeposit(senderContract.getSender(), toNano("5"));
      const withdrawalRequest = await mainContract.sendWithdrawalRequest(ownerContract.getSender(), toNano("0.01"), toNano("1"));
      expect(withdrawalRequest.transactions).toHaveTransaction({
        from: ownerContract.address,
        to: mainContract.address,
        success: true,
      });
      const balance = await mainContract.getBalance();
      expect(balance.number).toBeGreaterThan(toNano("3.99"));
      expect(withdrawalRequest.transactions).toHaveTransaction({
        from: mainContract.address,
        to: ownerContract.address,
        success: true,
        value: toNano(1),
      });
    });

    it("shouldn't withdraw funds from contracts others than owner", async () => {
      await mainContract.sendDeposit(senderContract.getSender(), toNano("5"));
      const withdrawalRequest = await mainContract.sendWithdrawalRequest(senderContract.getSender(), toNano("0.01"), toNano("1"));
      const data = await mainContract.getContractData();
      console.log("Owner address is: " + data.owner_address.toString());
      console.log("Sender address is: " + senderContract.getSender().address.toString());
      expect(withdrawalRequest.transactions).toHaveTransaction({
        from: mainContract.address,
        to: senderContract.address,
        success: true,
      });
      expect(withdrawalRequest.transactions).toHaveTransaction({
        from: senderContract.address,
        to: mainContract.address,
        success: false,
        exitCode: 103,
      });
      const balance = await mainContract.getBalance();
      expect(balance.number).toBeGreaterThan(toNano("4.99"));
      console.log("Contract balance is: " + balance.number);
    });

    it("should save some money for fees", async () => {
      await mainContract.sendDeposit(senderContract.getSender(), toNano("5"));
      const withdrawalRequest = await mainContract.sendWithdrawalRequest(ownerContract.getSender(), toNano("0.01"), toNano("4.99"));
      expect(withdrawalRequest.transactions).toHaveTransaction({
        from: ownerContract.address,
        to: mainContract.address,
        success: true,
      });
      expect(withdrawalRequest.transactions).toHaveTransaction({
        from: mainContract.address,
        to: ownerContract.address,
        success: true,
      });
      const balance = await mainContract.getBalance();
      expect(balance.number).toBeGreaterThanOrEqual(toNano("0.01"));
    });

    it("fails to withdraw funds because lack of balance", async () => {
      const withdrawalRequestResult = await mainContract.sendWithdrawalRequest(
        ownerContract.getSender(),
        toNano("0.5"),
        toNano("1")
      );
  
      expect(withdrawalRequestResult.transactions).toHaveTransaction({
        from: ownerContract.address,
        to: mainContract.address,
        success: false,
        exitCode: 104,
      });
    });
  
  });