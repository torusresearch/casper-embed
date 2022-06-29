<script lang="ts" setup>
import { onMounted, ref } from "vue";
import Torus from "@toruslabs/casper-embed";
import { CasperServiceByJsonRPC, CLPublicKey, CLValueBuilder, decodeBase16, DeployUtil, RuntimeArgs, verifyMessageSignature } from "casper-js-sdk";
import { SafeEventEmitterProvider } from "@toruslabs/base-controllers";
import copyToClipboard from "copy-to-clipboard";

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
const copied = ref<boolean>(false);
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
  console.log(el);
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
function getAddress(address: string) {
  if (address.length < 11) {
    return address;
  }
  if (typeof address !== "string") return "";
  return `${address.slice(0, 5)}...${address.slice(-5)}`;
}
function getNetworkType() {
  return torus?.provider.chainId === "0x1" ? "mainnet" : "testnet";
}

function copyToClip(account: string) {
  copied.value = true;
  copyToClipboard(account);
  setTimeout(() => {
    copied.value = false
  }, 500);
}
</script>

<template>
  <div v-if="isLoading">loading...</div>
  <div class="grid text-center justify-center pt-20" v-else-if="!account">
    <h7 class="font-bold text-3xl">demo-casper.tor.us</h7>
    <h6 class="pb-10 font-semibold text-[#595857]">Build Environment : testing</h6>
    <button @click="login" class="btn-login">Login with Private Key</button>
  </div>
  <div v-else>
    <div class="flex box md:rows-span-2 m-6">
      <div class="mt-7 ml-6">
        <h7 class="text-2xl font-semibold">demo-casper.tor.us</h7>
        <h6 class="pb-8 text-left">Provider : Casper</h6>
      </div>
      <div class="ml-auto mt-7">
        <button
          type="button"
          class="copy-btn"
          @click="
            () => {
              copyToClip(account);
            }
          "
        >
          <img class="pr-1" src="../assets/copy.svg" />
          <span>{{ copied? "Copied!" : getAddress(account) }}</span>
        </button>
        <button type="button" class="wifi-btn">
          <img src="../assets/wifi.svg" />
          <span class="font-semibold pl-2">{{ getNetworkType() }}</span>
        </button>
        <button type="button" @click="logout" class="btn-logout">
          <img src="../assets/logout.svg" class="pr-3 pl-0" />
          Logout
        </button>
      </div>
    </div>
    <div class="grid grid-cols-5 gap-7 m-6 height-fit">
      <div class="grid grid-cols-2 col-span-5 md:col-span-2 text-left gap-2 p-4 box md:pb-44">
        <div class="col-span-1">
          <div class="font-semibold">User Info</div>
          <div><button class="btn" @click="getUserInfo">Get User Info</button></div>
        </div>
        <div class="col-span-1">
          <div class="font-semibold">Provider</div>
          <div><button class="btn" @click="changeProvider">Change Provider</button></div>
        </div>
        <div class="col-span-1">
          <div class="font-semibold">Latest Block</div>
          <div><button class="btn" @click="getLatestBlock">Get latest block</button></div>
        </div>
        <div class="col-span-1">
          <div class="font-semibold">Signing</div>
          <div><button class="btn" @click="signMessage">Sign message</button></div>
        </div>
        <div class="col-span-2 text-left">
          <div class="font-semibold">Tokens</div>
          <div class="grid grid-cols-2 gap-2">
            <button class="btn" @click="approveErc20Tokens">Approve Erc20 Tokens</button>
            <button class="btn" @click="transferErc20Tokens">Transfer Erc20 Tokens</button>
          </div>
        </div>
        <div class="col-span-1">
          <div class="font-semibold">CSPR</div>
          <div><button class="btn" @click="sendCSPR">Send CSPR</button></div>
        </div>
      </div>
      <div class="box-grey" id="console">
        <p style="white-space: pre-line"></p>
        <div><button class="clear-button" @click="clearUiconsole">Clear console</button></div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.box {
  @apply bg-white;
  border: 1px solid #f3f3f4;
  border-radius: 20px;
  box-shadow: 4px 4px 20px rgba(46, 91, 255, 0.1);
}

.box-grey {
  @apply col-span-5 md:col-span-3 overflow-hidden min-h-[400px] bg-[#f3f3f4] rounded-3xl relative;
  border: 1px solid #f3f3f4;
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
  font-family: "DM Sans";
  font-style: normal;
  /* font-family: "Avenir", Helvetica, Arial, sans-serif; */
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
  @apply m-2;
}
.btn {
  @apply h-11 w-full m-0 bg-white rounded-3xl text-[#6F717A] text-sm lg:text-base font-medium;
  border: 1px solid #6f717a;
}

.copy-btn {
  @apply h-6 px-2 m-2 text-sm inline-flex items-center overflow-hidden bg-[#e9e9ea] rounded-3xl text-[#7F8FA4] leading-4 font-bold;
}

.wifi-btn {
  @apply h-6 w-24 text-sm inline-flex items-center text-center pl-3 rounded-3xl bg-[#cde0ff];
}
.btn-login {
  @apply h-12 w-80 bg-white rounded-3xl;
  border: 1px solid #6f717a;
}
.btn-logout {
  @apply h-12 w-32 bg-white rounded-3xl pl-6 m-2 text-sm inline-flex items-center;
  border: 1px solid #f3f3f4;
}
.clear-button {
  @apply absolute md:fixed right-8 bottom-2 md:right-8 md:bottom-12 w-28 h-7 bg-[#f3f3f4] rounded-md;
  border: 1px solid #0f1222;
}
.height-fit {
  @apply min-h-fit;
  height: 75vh;
}
</style>
