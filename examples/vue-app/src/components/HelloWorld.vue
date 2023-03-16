<script lang="ts" setup>
import { onMounted, ref } from "vue";
import Torus from "@toruslabs/casper-embed";
import { CasperServiceByJsonRPC, CLPublicKey, CLValueBuilder, decodeBase16, DeployUtil, RuntimeArgs, verifyMessageSignature } from "casper-js-sdk";
import { SafeEventEmitterProvider } from "@toruslabs/base-controllers";

// Name of target chain.
const DEPLOY_CHAIN_NAME = "casper-test";

// Gas payment for native transfers to be offered.
const DEPLOY_GAS_PAYMENT_FOR_NATIVE_TRANSFER = 100000;
const randomNumericId = () => Math.floor(Math.random() * 1000000000);

const CHAINS = {
  CASPER_MAINNET: "casper",
  CASPER_TESTNET: "casper-test",
};

const SUPPORTED_NETWORKS = {
  [CHAINS.CASPER_MAINNET]: {
    blockExplorerUrl: "https://cspr.live",
    chainId: "0x1",
    displayName: "Casper Mainnet",
    logo: "https://cspr.live/assets/icons/logos/cspr-live-full.svg",
    rpcTarget: "https://casper-node.tor.us",
    ticker: "CSPR",
    tickerName: "Casper Token",
    networkKey: CHAINS.CASPER_MAINNET,
  },
  [CHAINS.CASPER_TESTNET]: {
    blockExplorerUrl: "https://testnet.cspr.live",
    chainId: "0x2",
    displayName: "Casper Testnet",
    logo: "https://testnet.cspr.live/assets/icons/logos/cspr-live-full.svg",
    rpcTarget: "https://testnet.casper-node.tor.us",
    ticker: "CSPR",
    tickerName: "Casper Token",
    networkKey: CHAINS.CASPER_TESTNET,
  },
};

let torus: Torus | null = null;

const account = ref<string>("");
const isLoading = ref<boolean>(false);

onMounted(async () => {
  try {
    isLoading.value = true;
    torus = new Torus();
    await torus.init({
      showTorusButton: true,
      network: SUPPORTED_NETWORKS[CHAINS.CASPER_TESTNET],
    });
  } catch (error) {
    console.error(error);
  } finally {
    isLoading.value = false;
  }
});

const login = async () => {
  const loginaccs = await torus?.login();
  account.value = (loginaccs || [])[0] || "";
};

const changeProvider = async () => {
  const providerRes = await torus?.setProvider(SUPPORTED_NETWORKS[CHAINS.CASPER_MAINNET]);
  uiConsole("provider res", providerRes);
};

const getLatestBlock = async () => {
  const casperService = new CasperServiceByJsonRPC(torus?.provider as SafeEventEmitterProvider);
  const latestBlock = await casperService.getLatestBlockInfo();
  uiConsole("latest block", latestBlock);
};

const getUserInfo = async () => {
  const userInfo = await torus?.getUserInfo();
  uiConsole("userInfo", userInfo);
};

const signMessage = async () => {
  try {
    const message = "test message";
    const res = await torus?.signMessage({
      message,
      from: account.value,
    });
    if (res?.signature) {
      const pubKey = CLPublicKey.fromHex(account.value);
      const isVerified = verifyMessageSignature(pubKey, message, res?.signature);
      uiConsole(`signature verified: ${isVerified}`, res.signature);
    } else {
      uiConsole("signature", "failed to sign message");
    }
  } catch (error) {
    uiConsole("failed to sign message", error);
  }
};

const logout = async () => {
  try {
    await torus?.logout();
    account.value = "";
  } catch (error) {
    uiConsole("logout error", error);
  }
};
const sendCSPR = async () => {
  try {
    const receiverClPubKey = CLPublicKey.fromHex("02036d0a481019747b6a761651fa907cc62c0d0ebd53f4152e9f965945811aed2ba8");
    const senderKey = CLPublicKey.fromHex(account.value);
    const deploy = DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(senderKey, DEPLOY_CHAIN_NAME, 1, 1800000),
      DeployUtil.ExecutableDeployItem.newTransfer(
        2500000000, // 2.5 cspr
        receiverClPubKey, // receiver CLPubKey
        null, // we will use main purse, so it can be left null
        randomNumericId()
      ),
      DeployUtil.standardPayment(DEPLOY_GAS_PAYMENT_FOR_NATIVE_TRANSFER)
    );

    const casperService = new CasperServiceByJsonRPC(torus?.provider as SafeEventEmitterProvider);
    const deployRes = await casperService.deploy(deploy);
    uiConsole("deploy res", deployRes);
  } catch (error) {
    uiConsole(error);
  }
};

const transferErc20Tokens = async () => {
  const AMOUNT_TO_TRANSFER = 2000000000000;
  // Gas price to be offered.
  const DEPLOY_GAS_PRICE = 1;
  // Time interval in milliseconds after which deploy will not be processed by a node.
  const DEPLOY_TTL_MS = 1800000;
  const DEPLOY_GAS_PAYMENT = 200000000000;
  const receiverCLPubKey = CLPublicKey.fromHex("02036d0a481019747b6a761651fa907cc62c0d0ebd53f4152e9f965945811aed2ba8");
  const senderKey = CLPublicKey.fromHex(account.value);

  const casperService = new CasperServiceByJsonRPC(torus?.provider as SafeEventEmitterProvider);

  const contractHash = "9EccB15D2001D57c971185D05be97Ac43C2E2bDA5ACd13D47d681B23a0A5979b";
  const contractHashAsByteArray = decodeBase16(contractHash);

  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(senderKey, DEPLOY_CHAIN_NAME, DEPLOY_GAS_PRICE, DEPLOY_TTL_MS),
    DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      contractHashAsByteArray,
      "transfer",
      RuntimeArgs.fromMap({
        amount: CLValueBuilder.u256(AMOUNT_TO_TRANSFER),
        recipient: CLValueBuilder.byteArray(receiverCLPubKey.toAccountHash()),
      })
    ),
    DeployUtil.standardPayment(DEPLOY_GAS_PAYMENT)
  );

  const deployRes = await casperService.deploy(deploy);
  uiConsole(deployRes);
};

const approveErc20Tokens = async (): Promise<void> => {
  const casperService = new CasperServiceByJsonRPC(torus?.provider as SafeEventEmitterProvider);

  const spenderCLPubKey = CLPublicKey.fromHex(account.value);

  // Gas price to be offered.
  const DEPLOY_GAS_PRICE = 1;
  // Time interval in milliseconds after which deploy will not be processed by a node.
  const DEPLOY_TTL_MS = 1800000;
  const DEPLOY_GAS_PAYMENT = 200000000000;
  const AMOUNT_TO_APPROVE = 1000000000000;
  const contractHash = "9EccB15D2001D57c971185D05be97Ac43C2E2bDA5ACd13D47d681B23a0A5979b";
  const contractHashAsByteArray = decodeBase16(contractHash);

  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(spenderCLPubKey, DEPLOY_CHAIN_NAME, DEPLOY_GAS_PRICE, DEPLOY_TTL_MS),
    DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      contractHashAsByteArray,
      "approve",
      RuntimeArgs.fromMap({
        amount: CLValueBuilder.u256(AMOUNT_TO_APPROVE),
        spender: CLValueBuilder.byteArray(spenderCLPubKey.toAccountHash()),
      })
    ),
    DeployUtil.standardPayment(DEPLOY_GAS_PAYMENT)
  );

  const deployRes = await casperService.deploy(deploy);
  uiConsole(deployRes);
};
const uiConsole = (...args: unknown[]): void => {
  const el = document.querySelector("#console>p");
  if (el) {
    el.innerHTML = JSON.stringify(args || {}, null, 2);
  }
};
</script>

<template>
  <div v-if="isLoading">loading...</div>
  <div class="hello" v-else-if="!account">
    <button @click="login">Login</button>
  </div>
  <div class="hello" v-else>
    Logged in with {{ account }}
    <div>
      <button @click="getUserInfo">Get User Info</button>
      <button @click="changeProvider">Change Provider</button>
      <button @click="getLatestBlock">Get Latest Block</button>
      <button @click="signMessage">Sign Message</button>
      <button @click="sendCSPR">Send CSPR</button>
      <button @click="approveErc20Tokens">Approve Erc20 Tokens</button>
      <button @click="transferErc20Tokens">Transfer Erc20 Tokens</button>
      <button @click="logout">Logout</button>
    </div>
    <div>
      <div id="console" style="white-space: pre-line">
        <p style="white-space: pre-line"></p>
      </div>
    </div>
  </div>
</template>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
#app {
  font-family: "Avenir", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
#console {
  border: 2px solid black;
  height: 300px;
  padding: 2px;
  text-align: left;
  width: calc(100% - 20px);
  border-radius: 5px;
  margin-top: 20px;
  margin-bottom: 80px;
}
#console > p {
  margin: 0.5em;
}
button {
  height: 25px;
  margin: 5px;
  background: none;
  border-radius: 5px;
}
</style>
