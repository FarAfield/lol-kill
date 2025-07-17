import { createApp } from "vue";
import ArcoVue from "@arco-design/web-vue";
import router from "@/router";
import store from "@/store";
import App from "@/App.vue";
import "@arco-design/web-vue/dist/arco.less";
import "@/assets/style/global.less";

const app = createApp(App);

app.use(ArcoVue, {});
app.use(router);
app.use(store);

app.mount("#app");
