import { createRouter, createWebHistory } from 'vue-router'

const constantRoutes = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('@/views/home/index.vue'),
    meta: { title: '主页' },
  },
  {
    path: '/game-test-mini',
    name: 'game-test-mini',
    component: () => import('@/views/game-test-mini/index.vue'),
    meta: { title: '最小化测试' },
  },
  {
    path: '/game',
    name: 'game',
    component: () => import('@/views/game/index.vue'),
    meta: { title: '游戏桌面' },
  },
  {
    path: '/game-text',
    name: 'game-text',
    component: () => import('@/views/game-text/index.vue'),
    meta: { title: '文字调试版' },
  },
  // {
  //   path: "/hero",
  //   name: "hero",
  //   component: () => import("@/views/source/hero/index.vue"),
  //   meta: { title: "英雄" },
  // },
  // {
  //   path: "/equip",
  //   name: "equip",
  //   component: () => import("@/views/source/equip/index.vue"),
  //   meta: { title: "装备" },
  // },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: constantRoutes,
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
