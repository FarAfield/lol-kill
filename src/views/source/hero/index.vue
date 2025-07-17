<template>
  <div class="root">
    <div class="hero-list" v-if="!current">
      <div class="search">
        <a-input
          v-model="keyword"
          size="large"
          placeholder="请输入搜索关键字"
          allowClear
        ></a-input>
      </div>
      <div class="content">
        <a-space fill :size="[24, 24]" wrap>
          <a-card
            v-for="item in filterHeroList"
            @click="handleSelect(item)"
            style="cursor: pointer"
          >
            <div class="item">
              <a-image
                :width="64"
                :height="64"
                fit="contain"
                :preview="false"
                :src="item.src"
              >
              </a-image>
              <div class="title">
                <div>{{ item.title }}</div>
                <div>{{ item.name }}</div>
              </div>
            </div>
          </a-card>
        </a-space>
      </div>
    </div>
    <div class="hero-detail" v-if="current">
      <div class="info">
        <a-image
          :width="128"
          :height="128"
          fit="contain"
          :preview="false"
          :src="current.src"
        >
        </a-image>
        <div class="title">
          <div>{{ current.title }}</div>
          <div>{{ current.name }}</div>
        </div>
        <a-space class="button" :size="24" direction="vertical">
          <a-button
            type="outline"
            :disabled="currentIndex === heroList.length - 1"
            @click="handleNext"
            >下一个</a-button
          >
          <a-button type="outline" @click="handleBack">返回</a-button>
          <a-button
            type="outline"
            :disabled="currentIndex === 0"
            @click="handleLast"
            >上一个</a-button
          >
        </a-space>
      </div>
      <div class="other">
        <a-carousel
          v-model:current="skinIndex"
          :autoPlay="true"
          animation-name="card"
          indicator-position="outer"
          indicator-type="line"
          show-arrow="always"
          class="carousel"
        >
          <a-carousel-item
            v-for="(item, index) in current.skins"
            class="carouselItem"
          >
            <a-image
              :width="380"
              :height="380"
              fit="contain"
              :src="item.skin"
              :preview="false"
            >
            </a-image>
          </a-carousel-item>
        </a-carousel>
        <div class="extra">
          {{
            current.skins[skinIndex - 1].name === "default"
              ? `${current.title} ${current.name}`
              : current.skins[skinIndex - 1].name
          }}
        </div>
        <div class="spell">
          <a-space :size="24">
            <a-tooltip
              :content="item.description || '无描述'"
              v-for="item in current.spells"
            >
              <div class="spellItem">
                <a-image
                  :width="64"
                  :height="64"
                  fit="contain"
                  :src="item.icon"
                  :preview="false"
                  footer-position="outer"
                >
                </a-image>
                <div class="title">{{ item.name }}</div>
              </div>
            </a-tooltip>
          </a-space>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { dynamicImportModule } from "@/core/utils";
import { IGameHero } from "@/core/game.types";

// avatar 128*128
// skin 380*380
// spell 64*64
const heroList = ref<Array<IGameHero & { src: string }>>([]);
const keyword = ref("");
const current = ref<null | (IGameHero & { src: string })>(null);
const skinIndex = ref<number>(1);
onMounted(async () => {
  const modules = import.meta.glob("@/source/hero/**/*.ts");
  let list: Array<IGameHero & { src: string }> = [];
  for (const path in modules) {
    const packageName = path.split("/").at(-2);
    const fileName = path.split("/").at(-1)?.replace(".ts", "");
    const { importModule } = await dynamicImportModule(packageName!, fileName!);
    const module = importModule();
    list = list.concat(module);
  }
  heroList.value = list.map((i) => {
    i.src = getImage(i.avatar, "avatar");
    i.skins = i.skins.map((i) => {
      i.skin = getImage(i.skin, "skin");
      return i;
    });
    i.spells = i.spells.map((i) => {
      i.icon = getImage(i.icon, "spell");
      return i;
    });
    return i;
  });
});
const filterHeroList = computed(() => {
  if (keyword.value) {
    return heroList.value.filter(
      (item) =>
        item.title.includes(keyword.value) || item.name.includes(keyword.value)
    );
  } else {
    return heroList.value;
  }
});
const currentIndex = computed(() => {
  return heroList.value.findIndex((i) => i.id === current.value?.id);
});
function getImage(name: string, type: "avatar" | "skin" | "spell") {
  return "";
  switch (type) {
    case "avatar":
    case "spell":
      return new URL(
        `../../../assets/images/${type}/${name.replace(".png", "")}.png`,
        import.meta.url
      ).href;
    case "skin":
      return new URL(
        `../../../assets/images/${type}/${name.replace(".jpg", "")}.jpg`,
        import.meta.url
      ).href;
  }
}
function handleSelect(item: IGameHero & { src: string }) {
  current.value = item;
}

function handleLast() {
  current.value = heroList.value[currentIndex.value - 1];
  skinIndex.value = 1;
}
function handleBack() {
  current.value = null;
  skinIndex.value = 1;
}
function handleNext() {
  current.value = heroList.value[currentIndex.value + 1];
  skinIndex.value = 1;
}
</script>
<style lang="less" scoped>
.root {
  width: 888px;
  height: 720px;
  border: 1px solid rgb(var(--primary-6));
  box-sizing: border-box;
}
.hero-list {
  width: 100%;
  height: 100%;
  .search {
    padding: 36px 10%;
  }
  .content {
    padding-left: 24px;
    height: 600px;
    overflow: auto;
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
}
.hero-detail {
  padding: 72px 36px;
  display: flex;

  .info {
    width: 156px;
    height: 192px;
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
      }
      > div:nth-of-type(1) {
        font-weight: bold;
        margin-bottom: 8px;
      }
    }
    .button {
      margin-top: 48px;
    }
  }
  .other {
    flex: 1;
    margin-left: 24px;
    position: relative;
    .carousel {
      width: 100%;
      height: 408px;
      padding: 0 24px;
      .carouselItem {
        height: 380px;
        width: 380px;
      }
      :deep(.arco-carousel-arrow) {
        > div {
          background-color: rgb(var(--primary-6));
        }
      }
    }
    .extra {
      position: absolute;
      top: 65%;
      left: 50%;
      transform: translateX(-50%);
      height: 30px;
      text-align: center;
      white-space: nowrap;
      color: white;
    }
    .spell {
      margin-top: 48px;
      font-size: 14px;
      display: flex;
      justify-content: center;
      .spellItem {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .title {
        text-align: center;
        margin-top: 8px;
      }
    }
  }
}
</style>
