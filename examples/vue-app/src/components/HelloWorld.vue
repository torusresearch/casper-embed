<script lang="ts" setup>
import { onMounted, ref } from "vue";
import Torus from "@toruslabs/casper-embed";
import { CasperServiceByJsonRPC, CLPublicKey, DeployUtil, encodeBase16 } from "casper-js-sdk";
import { SafeEventEmitterProvider } from "@toruslabs/base-controllers";

// Name of target chain.
const DEPLOY_CHAIN_NAME = "casper-test";

// Gas payment for native transfers to be offered.
const DEPLOY_GAS_PAYMENT_FOR_NATIVE_TRANSFER = 100000;

const CHAINS = {
  CASPER_MAINNET: "casper",
  CASPER_TESTNET: "casper-test",
};

const CHAIN_ID_NETWORK_MAP = {
  "0x1": CHAINS.CASPER_MAINNET,
  "0x2": CHAINS.CASPER_TESTNET,
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
onMounted(async () => {
  torus = new Torus();
  await torus.init({
    buildEnv: "development",
    showTorusButton: true,
    network: SUPPORTED_NETWORKS[CHAINS.CASPER_TESTNET],
  });
});

const login = async () => {
  const loginaccs = await torus?.login();
  account.value = (loginaccs || [])[0] || ""
}

const changeProvider = async () => {
  const providerRes = await torus?.setProvider(SUPPORTED_NETWORKS[CHAINS.CASPER_MAINNET]);
  console.log("provider res", providerRes)
}

const getLatestBlock = async () => {
  const casperService = new CasperServiceByJsonRPC(torus?.provider as SafeEventEmitterProvider);
  const latestBlock  = await casperService.getLatestBlockInfo();
  console.log("latest block", latestBlock);
}

const sendCSPR = async () => {
  try {
    const receiverClPubKey = CLPublicKey.fromHex("02036d0a481019747b6a761651fa907cc62c0d0ebd53f4152e9f965945811aed2ba8")
    const senderKey = CLPublicKey.fromHex("020322c56bcb2a7904ccd37787d877b66722a45abdd2adf25fecfcc516aaf37ba303");
    let deploy = DeployUtil.makeDeploy(
        new DeployUtil.DeployParams(
          senderKey, 
          DEPLOY_CHAIN_NAME,
          1,
          1800000,
        ),
        DeployUtil.ExecutableDeployItem.newTransfer(
          2500000000, // 2.5 cspr
          receiverClPubKey, // receiver CLPubKey
          null, // we will use main purse, so it can be left null
          "12"
        ),
        DeployUtil.standardPayment(DEPLOY_GAS_PAYMENT_FOR_NATIVE_TRANSFER)
    );

  const casperService = new CasperServiceByJsonRPC(torus?.provider as SafeEventEmitterProvider);
  const deployRes  = await casperService.deploy(deploy);
  console.log("deploy res", deployRes);
    } catch (error) {
        console.log(error);
    }
}
</script>

<template>
  <div class="hello" v-if="!account">
    <button @click="login">Login</button>
  </div>
  <div class="hello" v-else>
    Logged in with {{ account }}
    <button @click="changeProvider">Change Provider</button>
    <button @click="getLatestBlock">Get Latest Block</button>
    <button @click="sendCSPR">Send CSPR</button>
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
</style>
