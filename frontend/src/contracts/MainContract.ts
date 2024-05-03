import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from "ton-core";

export type MainContractConfig = {
  counter: number;
  recent_sender: Address;
  owner_address: Address;
}

export function mainContractConfigToCell(config: MainContractConfig): Cell {
  return beginCell().storeUint(config.counter, 32).storeAddress(config.recent_sender).storeAddress(config.owner_address).endCell();
}

export class MainContract implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
      ) {}

    static createFromConfig(config: MainContractConfig, code: Cell, workchain = 0) {
        const data = mainContractConfigToCell(config);
        const init = { code, data };
        const address = contractAddress(workchain, init);
    
        return new MainContract(address, init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
      await provider.internal(via, {
        value,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        body: beginCell().endCell(),
      });
  }

    async sendIncrement(
        provider: ContractProvider,
        sender: Sender,
        value: bigint,
        increment_by: number
      ){
        let op_code = 1; //increase counter ops
        const msg_body = beginCell()
          .storeUint(op_code, 32)
          .storeUint(increment_by, 32)
          .endCell();
        await provider.internal(sender, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: msg_body,
          });
    }

    async sendDeposit(
      provider: ContractProvider,
      sender: Sender,
      value: bigint
    ){
      let op_code = 2; //deposit op
      const msg_body = beginCell()
          .storeUint(op_code, 32)
          .endCell();
        await provider.internal(sender, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: msg_body,
          });
    }

    async sendDepositWithoutOP(
      provider: ContractProvider,
      sender: Sender,
      value: bigint
    ){
        await provider.internal(sender, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
          });
    }

    async sendDepositWithWrongOP(
      provider: ContractProvider,
      sender: Sender,
      value: bigint
    ){
      let opcode = 333; // wrong OP
      const msg_body = beginCell()
      .storeUint(opcode, 32)
      .endCell();
        await provider.internal(sender, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: msg_body,
          });
    }

    async sendWithdrawalRequest(
      provider: ContractProvider,
      sender: Sender,
      value: bigint,
      withdrawAmount: bigint
    ){
      let opcode = 3; // withdraw
      const msg_body = beginCell()
      .storeUint(opcode, 32)
      .storeCoins(withdrawAmount)
      .endCell();
      await provider.internal(sender, {
          value,
          sendMode: SendMode.PAY_GAS_SEPARATELY,
          body: msg_body,
        });
    }

    async getContractData(provider: ContractProvider) {
        const { stack } = await provider.get("get_contract_storage_data", []);
        return {
          number: stack.readNumber(),
          recent_sender: stack.readAddress(),
          owner_address: stack.readAddress(),
        };
    }

    async getBalance(provider: ContractProvider) {
      const { stack } = await provider.get("balance", []);
      return {
        balance: stack.readNumber(),
      };
    }
}