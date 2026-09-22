<template>
  <div class="home-page">
    <div class="home-card">
      <h1>🎴 联盟杀</h1>
      <p class="subtitle">英雄联盟主题 · 三国杀规则</p>
      <div class="actions">
        <n-button type="primary" size="large" @click="goGame"> 进入游戏（图形版） </n-button>
        <n-button type="warning" size="large" @click="goGameText">
          进入游戏（文字调试版）
        </n-button>
        <n-button type="warning" size="large" @click="goGameMiniText">
          进入游戏（最小化调试版）
        </n-button>
      </div>
      <p class="desc">文字调试版: 所有玩家默认由AI控制，实时日志输出</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goGame(): void {
  router.push('/game')
}

function goGameText(): void {
  router.push('/game-text')
}

function goGameMiniText() {
  router.push('/game-test-mini')
}
</script>

<style lang="less" scoped>
.home-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #0d1117;
}

.home-card {
  text-align: center;
  padding: 48px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  max-width: 500px;

  h1 {
    font-size: 36px;
    color: #58a6ff;
    margin: 0 0 8px 0;
  }

  .subtitle {
    color: #8b949e;
    font-size: 14px;
    margin: 0 0 32px 0;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
  }

  .desc {
    color: #484f58;
    font-size: 12px;
    margin: 0;
  }
}
</style>
