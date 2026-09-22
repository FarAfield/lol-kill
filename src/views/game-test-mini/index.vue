<template>
  <n-button @click="handleClick"></n-button>
</template>
<script setup lang="ts">
import { GameBoot } from '@/core/boot/game-boot'

function handleClick() {
  GameBoot.createStandard5P()
}
</script>
<style lang="less" scoped></style>
