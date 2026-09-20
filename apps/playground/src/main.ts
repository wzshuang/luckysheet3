import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import Home from "./pages/Home.vue";
import CompatDemo from "./pages/CompatDemo.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/compat", component: CompatDemo },
  ],
});

createApp(App).use(router).mount("#app");
