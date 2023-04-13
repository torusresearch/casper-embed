import { createApp } from "vue";
import "@toruslabs/vue-components/dist/style.css";
import { createIcons } from "@toruslabs/vue-components";
import App from "./App.vue";

const app = createApp(App);

app.use(createIcons()).mount("#app");
