<template>
  <a-modal
    :visible="visible"
    :width="520"
    title="选择英雄"
    title-align="start"
    @before-ok="handleOk"
    @cancel="handleCancel"
  >
    <div class="hero-list">
      <a-card
        v-for="item in canSelectedHeroList"
        @click="selectedHero = item"
        style="cursor: pointer"
      >
        <div class="item">
          <a-image
            :width="64"
            :height="64"
            fit="contain"
            :preview="false"
            :src="item.avatar"
          >
          </a-image>
          <div class="title">
            <div>{{ item.title }}</div>
            <div>{{ item.name }}</div>
          </div>
        </div>
      </a-card>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import useGameStore from "@/core/gameStore";
import { getUniqueRandomNumbers } from "@/core/utils";
import { IGameHero } from "@/core/game.types";
import { cloneDeep } from "lodash-es";

const props = defineProps({
  showModal: {
    type: Boolean,
    default: false,
  },
  quantity: {
    type: Number,
    default: 3,
  },
});
const emits = defineEmits(["cancel", "confirm"]);

const gameStore = useGameStore();
const visible = ref(props.showModal);
const canSelectedHeroList = ref<Array<IGameHero>>([]);
const selectedHero = ref<IGameHero>();
const selectedSkin = ref<string>("");

const heroList = computed(() =>
  gameStore.heroList.filter(
    (i) => !gameStore.playerList.map((j) => j.id).includes(i.id)
  )
);
const canSelectedSkinList = computed(() => selectedHero.value?.skins || []);

onMounted(() => {
  canSelectedHeroList.value = getCanSelectedList();
  console.log(heroList.value, canSelectedHeroList.value);
});

function getCanSelectedList() {
  const randomList = getUniqueRandomNumbers(
    0,
    heroList.value.length - 1,
    props.quantity
  ).map((i) => heroList.value[i]);
  return cloneDeep(randomList).map((i: IGameHero) => {
    i.avatar = getImage(i.avatar, "avatar");
    i.skins = i.skins.map((j) => {
      j.skin = getImage(j.skin, "skin");
      return j;
    });
    return i;
  });
}
function getImage(name: string, type: "avatar" | "skin") {
  return "";
  //   switch (type) {
  //     case "avatar":
  //       return new URL(
  //         `../../assets/images/${type}/${name.replace(".png", "")}.png`,
  //         import.meta.url
  //       ).href;
  //     case "skin":
  //       return new URL(
  //         `../../assets/images/${type}/${name.replace(".jpg", "")}.jpg`,
  //         import.meta.url
  //       ).href;
  //   }
}

function handleOk() {
  handleCancel();
}

function handleCancel() {
  emits("cancel");
}
</script>

<style lang="less" scoped>
.hero-list {
  display: flex;
  justify-content: center;
  .item {
    height: 64px;
    width: 156px;
    display: flex;
    .title {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      margin-left: 8px;
      > div {
        text-align: center;
      }
      > div:nth-of-type(1) {
        font-weight: bold;
        margin-bottom: 4px;
      }
    }
  }
}
</style>
