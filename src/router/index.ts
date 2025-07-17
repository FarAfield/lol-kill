import { createRouter, createWebHistory } from "vue-router";

const constantRoutes = [
  {
    path: "/",
    redirect: "/home",
  },
  {
    path: "/home",
    name: "home",
    component: () => import("@/views/home/index.vue"),
    meta: { title: "主页" },
  },
  {
    path: "/test",
    name: "test",
    component: () => import("@/views/test/index.vue"),
    meta: { title: "测试" },
  },
  {
    path: "/game",
    name: "game",
    component: () => import("@/views/game/index.vue"),
    meta: { title: "游戏" },
  },
  {
    path: "/hero",
    name: "hero",
    component: () => import("@/views/source/hero/index.vue"),
    meta: { title: "英雄" },
  },
  {
    path: "/equip",
    name: "equip",
    component: () => import("@/views/source/equip/index.vue"),
    meta: { title: "装备" },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes: constantRoutes,
  scrollBehavior() {
    return { top: 0 };
  },
});
export default router;
export { constantRoutes };
