<template>
  <div class="root">
    <a-button type="primary" @click="handleClick">测试</a-button>
    <!-- <ChooseHero
      :showModal="true"
      :quantity="3"
      @cancel="() => {}"
      @confirm="(result) => console.log(result)"
    ></ChooseHero> -->
  </div>
</template>
<script setup lang="tsx">
import { defineComponent, h, render } from "vue";
import GameUi from "@/core/gameUi";
import ChooseHero from "@/components/chooseHero/index.vue";

function handleClick() {
  // GameUi.chooseHero();
  render(
    <ChooseHero title="选择英雄" visible={true}></ChooseHero>,
    document.body
  );
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
