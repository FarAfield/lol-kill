<template>
  <div class="root">
    <a-space :size="[20, 20]" fill wrap>
      <a-button
        v-for="item in constantRoutes.filter(
          (item) => !['/', '/home'].includes(item.path)
        )"
        type="primary"
        @click="handleSwitch(item.path)"
        >{{ item.meta.title }}</a-button
      >
    </a-space>
  </div>
</template>
<script setup>
import { constantRoutes } from "@/router";
import { useRouter } from "vue-router";

const router = useRouter();
function handleSwitch(path) {
  router.push(path);
}
</script>
<style lang="less" scoped>
.root {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
