<template>
  <div class="root">
    <a-space class="button-group">
      <a-button
        v-for="item in buttonGroup"
        :disabled="item.disabled"
        @click="item.click"
        type="outline"
        >{{ item.title }}</a-button
      >
    </a-space>
    <div class="content"></div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import GameBoot from "@/core/gameBoot";
import GameEngine from "@/core/gameEngine";

const gameStatus = ref<"ready" | "running" | "paused">("ready");

const buttonGroup = computed(() => {
  return [
    {
      title: "开始",
      disabled: gameStatus.value !== "ready",
      click: () => {
        gameStatus.value = "running";
        GameBoot.onBoot();
      },
    },
    {
      title: "暂停",
      disabled: gameStatus.value !== "running",
      click: () => {
        gameStatus.value = "paused";
        GameEngine.pause();
      },
    },
    {
      title: "恢复",
      disabled: gameStatus.value !== "paused",
      click: () => {
        gameStatus.value = "running";
        GameEngine.resume();
      },
    },
    {
      title: "结束",
      disabled: gameStatus.value === "ready",
      click: () => {
        gameStatus.value = "ready";
        GameEngine.over();
      },
    },
  ];
});
</script>
<style lang="less" scoped>
.root {
  width: 888px;
  height: 720px;
  border: 1px solid rgb(var(--primary-6));
  box-sizing: border-box;
}
.button-group {
  padding: 36px;
}
.content {
}
</style>
