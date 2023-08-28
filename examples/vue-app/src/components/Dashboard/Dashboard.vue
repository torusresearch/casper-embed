<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { Icon } from "@toruslabs/vue-components";
import Torus from "@toruslabs/casper-embed";

import Button from "../Button";

const MAINNET_CHAIN_ID = "0x1";

const CHAINS = {
  MAINNET: "mainnet",
};

const SUPPORTED_NETWORKS = {
  [CHAINS.MAINNET]: {
    blockExplorerUrl: "https://etherscan.io",
    chainId: MAINNET_CHAIN_ID,
    displayName: "Main Ethereum Network",
    logo: "eth.svg",
    rpcTarget: "https://rpc.ankr.com/eth",
    ticker: "ETH",
    tickerName: "Ethereum",
    type: CHAINS.MAINNET,
  }
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
      network: SUPPORTED_NETWORKS[CHAINS.MAINNET],
      buildEnv: 'development',
      enableLogging: true,
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

const getUserInfo = async () => {
  const userInfo = await torus?.getUserInfo();
  uiConsole("User Info", userInfo);
};

const logout = async () => {
  try {
    await torus?.logout();
    account.value = "";
  } catch (error) {
    uiConsole("Logout Error", error);
  }
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
    <h1 class="login-heading">Demo</h1>
    <h3 class="login-subheading">Build Environment : testing</h3>
    <!-- <div class="login-btn">
      <Button @on-click="login">Login</Button>
    </div> -->
  </div>
  <!-- Dashboard -->
  <div v-else class="dashboard-container">
    <!-- Dashboard Header -->
    <div class="dashboard-header">
      <div class="heading-mb">
        <h1 class="dashboard-heading">Demo</h1>
        <p class="dashboard-subheading">Provider : mainnet</p>
      </div>
      <div class="dashboard-action-container">
        <div class="header-mb">
          <button class="dashboard-action-address" @click.stop="copyAccountAddress" :title="account">
            <Icon :name="isCopied ? 'tor-check-circle-solid-icon' : 'tor-document-duplicate-solid-icon'" size="14" />{{
              formatedAccountAddress }}
          </button>
          <div class="dashboard-action-badge">
            <Icon name="tor-wifi-solid-icon" size="14" /> mainnet
          </div>
        </div>
        <button class="dashboard-action-logout" @click.stop="logout">
          <img class="logout-img" :src="require('@/assets/logout.svg')" alt="logout" height="20" width="20" />
          Logout
        </button>
      </div>
    </div>
    <!-- Dashboard Action Container -->
    <div class="dashboard-details-container">
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
