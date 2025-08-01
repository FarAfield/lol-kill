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
        @click="() => handleSelectHero(item)"
        :class="['card', { active: selectedHero?.id === item.id }]"
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
import { ref, computed, onMounted, nextTick } from "vue";
import useGameStore from "@/core/gameStore";
import { getUniqueRandomNumbers, getRandomNumber } from "@/core/utils";
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
const emits = defineEmits(["select"]);

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
onMounted(() => {
  canSelectedHeroList.value = getCanSelectedList();
  console.log(
    "可选择英雄列表：",
    canSelectedHeroList.value.map((i) => i.name)
  );
  // 若不显示弹窗，直接选择
  if (!visible.value) {
    nextTick(() => handleCancel());
  }
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
  switch (type) {
    case "avatar":
      return "";
    // return new URL(
    //   `../../assets/images/${type}/${name.replace(".png", "")}.png`,
    //   import.meta.url
    // ).href;
    case "skin":
      return "";
    // return new URL(
    //   `../../assets/images/${type}/${name.replace(".jpg", "")}.jpg`,
    //   import.meta.url
    // ).href;
  }
}

function handleSelectHero(hero: IGameHero) {
  selectedHero.value = hero;
  selectedSkin.value =
    hero.skins[getRandomNumber(0, hero.skins.length - 1)].skin;
}

function handleOk() {
  console.log("选择的英雄：", selectedHero.value!.name);
  emits("select", {
    ...selectedHero.value,
    avatar: selectedSkin.value,
  });
}

function handleCancel() {
  // 随机选择英雄和皮肤
  selectedHero.value =
    canSelectedHeroList.value[
      getRandomNumber(0, canSelectedHeroList.value.length - 1)
    ];
  selectedSkin.value =
    selectedHero.value.skins[
      getRandomNumber(0, selectedHero.value.skins.length - 1)
    ].skin;
  console.log("选择的英雄：", selectedHero.value!.name);
  emits("select", {
    ...selectedHero.value,
    avatar: selectedSkin.value,
  });
}
</script>

<style lang="less" scoped>
.hero-list {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  .card {
    cursor: pointer;
    margin: 12px;
  }
  .active {
    outline: 2px solid rgb(var(--primary-6));
  }
  .item {
    width: 96px;
    height: 128px;
    display: flex;
    flex-direction: column;
    align-items: center;
    .title {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      margin-top: 12px;
      > div {
        text-align: center;
        white-space: nowrap;
      }
      > div:nth-of-type(1) {
        font-weight: bold;
        margin-bottom: 8px;
      }
    }
  }
}
</style>
