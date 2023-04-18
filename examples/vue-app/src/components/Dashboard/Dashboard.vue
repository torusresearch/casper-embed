<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { Icon } from "@toruslabs/vue-components";
import Torus from "@toruslabs/casper-embed";

import { CasperServiceByJsonRPC, CLPublicKey, CLValueBuilder, decodeBase16, DeployUtil, RuntimeArgs, verifyMessageSignature } from "casper-js-sdk";
import { SafeEventEmitterProvider } from "@toruslabs/base-controllers";

import Button from "../Button";

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
const isCopied = ref(false);

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
  isLoading.value = true;
  const loginaccs = await torus?.login();
  account.value = (loginaccs || [])[0] || "";
  isLoading.value = false;
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
      uiConsole("Signature", "failed to sign message");
    }
  } catch (error) {
    uiConsole("Failed to sign message", error);
  }
};

const logout = async () => {
  try {
    await torus?.logout();
    account.value = "";
  } catch (error) {
    uiConsole("Logout Error", error);
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
    uiConsole("CSPR Response", deployRes);
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
  uiConsole("Transfer ERC20 Token Response", deployRes);
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
  uiConsole("Approve ERC20 Token Response", deployRes);
};

const uiConsole = (...args: unknown[]): void => {
  const el = document.querySelector("#console>pre");
  const h1 = document.querySelector("#console>h1");
  const consoleBtn = document.querySelector<HTMLElement>("#console>div.clear-console-btn");
  if (h1) {
    h1.innerHTML = args[0] as string;
  }
  if (el) {
    el.innerHTML = JSON.stringify(args[1] || {}, null, 2);
  }
  if (consoleBtn) {
    consoleBtn.style.display = "block";
  }
};

const clearConsole = () => {
  const el = document.querySelector("#console>pre");
  const h1 = document.querySelector("#console>h1");
  const consoleBtn = document.querySelector<HTMLElement>("#console>div.clear-console-btn");
  if (h1) {
    h1.innerHTML = "";
  }
  if (el) {
    el.innerHTML = "";
  }
  if (consoleBtn) {
    consoleBtn.style.display = "none";
  }
};

const formatedAccountAddress = computed(() => {
  return `${account.value.substring(0, 5)}...${account.value.substring(account.value.length - 6)}`;
});

const copyAccountAddress = () => {
  navigator.clipboard.writeText(account.value);
  isCopied.value = true;
  setTimeout(() => (isCopied.value = false), 1000);
};
</script>

<template>
  <!-- Loader -->
  <div class="loader-container" v-if="isLoading">Loading...</div>
  <!-- Login -->
  <div class="login-container" v-else-if="!account">
    <h1 class="login-heading">demo-casper.tor.us</h1>
    <h3 class="login-subheading">Build Environment : testing</h3>
    <div class="login-btn">
      <Button @on-click="login">Login</Button>
    </div>
  </div>
  <!-- Dashboard -->
  <div v-else class="dashboard-container">
    <!-- Dashboard Header -->
    <div class="dashboard-header">
      <div>
        <h1 class="dashboard-heading">demo-casper.tor.us</h1>
        <p class="dashboard-subheading">Provider : casper</p>
      </div>
      <div class="dashboard-action-container">
        <button class="dashboard-action-address" @click.stop="copyAccountAddress" :title="account">
          <Icon :name="isCopied ? 'tor-check-circle-solid-icon' : 'tor-document-duplicate-solid-icon'" size="14" />{{ formatedAccountAddress }}
        </button>
        <div class="dashboard-action-badge"><Icon name="tor-wifi-solid-icon" size="14" /> mainnet</div>
        <button class="dashboard-action-logout" @click.stop="logout">
          <img :src="require('@/assets/logout.svg')" alt="logout" height="20" width="20" /> Logout
        </button>
      </div>
    </div>
    <!-- Dashboard Action Container -->
    <div class="dashboard-details-container">
      <div class="dashboard-details-btn-container">
        <div class="flex-row">
          <Button @on-click="getUserInfo" label="User info">Get User Info</Button>
          <Button @on-click="changeProvider" label="Provider">Change Provider</Button>
        </div>
        <div class="flex-row">
          <Button @on-click="getLatestBlock" label="Latest Block">Get latest block</Button>
          <Button @on-click="signMessage" label="Signing">Sign message</Button>
        </div>
        <div class="flex-row">
          <Button @on-click="approveErc20Tokens" label="Tokens" classes="detail-btn">Approve Erc20 Tokens</Button>
          <Button @on-click="transferErc20Tokens" class="token-btn">Transfer Erc20 Tokens</Button>
        </div>
        <div class="flex-row">
          <Button @on-click="sendCSPR" label="CSPR">Send CSPR</Button>
        </div>
      </div>
      <!-- Dashboard Console Container -->
      <div class="dashboard-details-console-container" id="console">
        <h1 class="console-heading"></h1>
        <pre class="console-container"></pre>
        <div class="clear-console-btn">
          <Button :pill="false" :block="false" small @on-click="clearConsole">Clear console</Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import "Dashboard.css";
</style>
