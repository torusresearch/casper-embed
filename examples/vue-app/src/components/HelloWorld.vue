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
    console.log(torus.provider.chainId);
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
  uiConsole("Provider Response", providerRes);
};

const getLatestBlock = async () => {
  const casperService = new CasperServiceByJsonRPC(torus?.provider as SafeEventEmitterProvider);
  const latestBlock = await casperService.getLatestBlockInfo();
  uiConsole("Latest Block", latestBlock);
};

const getUserInfo = async () => {
  console.log(torus?.provider);
  const userInfo = await torus?.getUserInfo();
  uiConsole("User Info", userInfo);
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
      uiConsole(`Signature verified: ${isVerified}`, res.signature);
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
    let deploy = DeployUtil.makeDeploy(
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

  let deploy = DeployUtil.makeDeploy(
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

  let deploy = DeployUtil.makeDeploy(
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
    el.innerHTML = `<span class="font-semibold">${args[0]}</span>` + `\n\n${JSON.stringify(args[1] || {}, null, 2)}`;
  }
};
const clearUiconsole = (): void => {
  const el = document.querySelector("#console>p");
  if (el) {
    el.innerHTML = "";
  }
};
</script>

<template>
  <div v-if="isLoading">loading...</div>
  <div class="grid text-center justify-center pt-20" v-else-if="!account">
    <h7 class="font-bold text-3xl">demo-casper.tor.us</h7>
    <h6 class="pb-10 font-semibold">Build Environment : testing</h6>
    <button @click="login" class="btn-login">Login with Private Key</button>
  </div>
  <div class="grid md:grid-rows-6 max-h-screen" v-else>
    <div class="md:rows-span-2 box grid md:grid-cols-12 p-5">
      <div class="col-span-9 text-left">
        <h7 class="text-2xl font-semibold">demo-casper.tor.us</h7>
        <h6 class="pb-10 ">Provider : Casper</h6>
      </div>
      <div class="col-span-1 pt-2">
        <button class="copy-btn text-sm px-2 inline-flex items-center overflow-hidden">
          <img src="../assets/copy.svg" class="pl-0 m-0" />
          <span>{{ account }}</span>
        </button>
      </div>
      <div class="col-span-1 pt-2">
        <button type="button" class="wifi-btn text-sm px-5 inline-flex items-center">
          <img src="../assets/wifi.svg" class="pr-3 pl-0" />
          testnet
        </button>
      </div>
      <div class="col-span-1">
        <button type="button" @click="logout" class="btn text-sm px-5 inline-flex items-center">
          <img src="../assets/logout.svg" class="pr-3 pl-0" />
          Logout
        </button>
      </div>
    </div>

    <div class="grid md:rows-span-4 gap-2 md:grid-cols-5 height-fit mx-2">
      <div class="grid md:col-span-2 md:grid-row-10 gap-1 box text-left pl-5">
        <div class="grid md:grid-cols-2 row-span-1 pt-10">
          <div class="col-span-1">
            <span class="pl-2 font-semibold">User Info</span><button @click="getUserInfo" class="btn">Get User Info</button>
          </div>
          <div class="col-span-1">
            <span class="pl-2 font-semibold">Provider</span><button @click="changeProvider" class="btn">Change Provider</button>
          </div>
        </div>
        <div class="grid md:grid-cols-2 row-span-1">
          <div class="col-span-1">
            <span class="pl-2 text-left font-semibold">Latest Block</span><button @click="getLatestBlock" class="btn">Get Latest Block</button>
          </div>
          <div class="md:col-span-1"><span class="pl-2 font-semibold">Signing</span><button @click="signMessage" class="btn">Sign Message</button></div>
        </div>
        <div class="grid md:row-span-1 grid-row-5">
          <div class="md:row-span-1 pb-0 margin-negate">
            <span class="pl-2 pb-0 font-semibold">Tokens</span>
          </div>
          <div class="grid md:grid-cols-2 row-span-4 pt-0">
            <div class="col-span-1 pt-0"><button @click="approveErc20Tokens" class="btn">Approve Erc20 Tokens</button></div>
            <div class="col-span-1"><button @click="transferErc20Tokens" class="btn">Transfer Erc20 Tokens</button></div>
          </div>
        </div>
        <div class="grid md:row-span-1 md:grid-row-5">
          <div class="md:row-span-1 pb-0 margin-negate">
            <span class="pl-2 pb-0 font-semibold">CSPR</span>
          </div>
          <div class="grid md:grid-cols-2 md:row-span-4 pt-0">
            <div class="col-span-1"><button @click="sendCSPR" class="btn">Send CSPR</button></div>
          </div>
        </div>
        <div class="md:row-span-5"></div>
      </div>
      <div class="grid md:col-span-3 box-grey overflow-hidden" id="console">
        <p style="white-space: pre-line"></p>
        <div><button class="clear-button" @click="clearUiconsole">Clear console</button></div>
      </div>
    </div>
  </div>
</template>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.box {
  margin: 1%;
  background: linear-gradient(0deg, #ffffff, #ffffff), #f3f3f4;
  border: 1px solid #f3f3f4;
  border-radius: 20px;
  box-shadow: 4px 4px 20px rgba(46, 91, 255, 0.1);
}

.box-grey {
  margin: 1%;
  background: #f3f3f4;
  border: 1px solid #f3f3f4;
  border-radius: 20px;
  box-shadow: 4px 4px 20px rgba(46, 91, 255, 0.1);
}
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
}
#console {
  text-align: left;
  overflow: auto;
}
#console > p {
  margin: 0.5em;
}
.btn {
  height: 40px;
  margin: 5px;
  width: 90%;
  /* background: none; */
  box-sizing: border-box;

  background: #ffffff;
  /* Shades of Grey/secondary-grey */

  border: 1px solid #6f717a;
  box-shadow: 2px 2px 12px rgba(3, 100, 255, 0.05);
  border-radius: 24px;
}

.copy-btn {
  height: 24px;
  margin-top: 5px;
  width: 90%;
  /* background: none; */
  box-sizing: border-box;
  /* Shades of Grey/secondary-grey */
  background: #e9e9ea;

  box-shadow: 2px 2px 12px rgba(3, 100, 255, 0.05);
  border-radius: 24px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.wifi-btn {
  height: 24px;
  margin-top: 5px;
  width: 90%;
  /* background: none; */
  box-sizing: border-box;
  background: #cde0ff;
  /* Shades of Grey/secondary-grey */
  box-shadow: 2px 2px 12px rgba(3, 100, 255, 0.05);
  border-radius: 24px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.height-fit {
  height: 80vh;
}

.margin-negate {
  margin-bottom: -0.6rem;
}
.clear-button {
  position: absolute;
  right: 2rem;
  bottom: 3rem;
  width: 116px;
  height: 28px;
  border-radius: 6px;
  background: #f3f3f4;
  border: 1px solid #0f1222;
}
.btn-login {
  height: 40px;
  margin: 5px;
  width: 20em;
  /* background: none; */
  box-sizing: border-box;

  background: #ffffff;
  /* Shades of Grey/secondary-grey */

  border: 1px solid #6f717a;
  box-shadow: 2px 2px 12px rgba(3, 100, 255, 0.05);
  border-radius: 24px;
}
</style>
