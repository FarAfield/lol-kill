<template>
  <div class="root">
    <a-button type="primary" @click="handleClick">测试</a-button>
  </div>
</template>
<script setup lang="tsx">
import { defineComponent, h, render } from "vue";
import GameUi from "@/core/gameUi";
import GameBoot from "@/core/gameBoot";

async function handleClick() {
  await GameBoot.onBoot();
  const a = await GameUi.chooseHero();
  console.log(a);
  console.log(456);
}
</script>
<style lang="less" scoped>
.root {
  width: 888px;
  height: 720px;
  border: 1px solid rgb(var(--primary-6));
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
