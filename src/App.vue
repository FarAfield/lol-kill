<template>
  <a-config-provider :locale="zhCN" update-at-scroll>
    <router-view />
    <a-button
      type="primary"
      style="position: fixed; top: 32px; left: 32px"
      @click="router.push('/')"
      >返回首页</a-button
    >
  </a-config-provider>
</template>
<script lang="ts" setup>
import zhCN from "@arco-design/web-vue/es/locale/lang/zh-cn";
import { useRouter } from "vue-router";
const router = useRouter();
</script>
