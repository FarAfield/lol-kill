<template>
  <div class="root">
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
        <a-card v-for="item in filterList">
          <div class="item">
            <a-image
              :width="64"
              :height="64"
              fit="contain"
              :preview="false"
              :src="item.image"
            >
            </a-image>
            <a-tooltip :content="item.description || '无描述'">
              <div class="title">
                <div>{{ item.name }}</div>
                <a-tag :color="item.color">{{ item.type }}</a-tag>
              </div>
            </a-tooltip>
          </div>
        </a-card>
      </a-space>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, PropType } from "vue";
import { cloneDeep } from "lodash-es";

const Color = [
  "#f53f3f",
  "#7816ff",
  "#00b42a",
  "#165dff",
  "#ff7d00",
  "#eb0aa4",
  "#7bc616",
  "#b71de8",
  "#0fc6c2",
  "#ffb400",
  "#168cff",
  "#ff5722",
];
const props = defineProps({
  list: {
    type: Array,
    default: () => [],
  },
  type: {
    type: String as PropType<"equip" | "magic" | "rune">,
    default: "equip",
  },
});
const keyword = ref("");
const allList = computed(() => {
  const typeList = props.list.map((i: any) => i.type);
  return props.list.map((item: any) => {
    const i = cloneDeep(item);
    i.image = getImage(i.image, props.type);
    i.color = Color[typeList.indexOf(i.type)];
    return i;
  });
});
const filterList = computed(() => {
  if (keyword.value) {
    return allList.value.filter((item: any) =>
      item.name.includes(keyword.value)
    );
  } else {
    return allList.value;
  }
});
function getImage(name: string, type: "equip" | "magic" | "rune") {
  return "";
  // return new URL(
  //   `../../../assets/images/${type}/${name.replace(".png", "")}.png`,
  //   import.meta.url
  // ).href;
}
</script>
<style lang="less" scoped>
.root {
  width: 888px;
  height: 720px;
  border: 1px solid rgb(var(--primary-6));
  box-sizing: border-box;
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
      cursor: pointer;
    }
    .title {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      > div:nth-of-type(1) {
        font-weight: bold;
        margin-bottom: 8px;
      }
    }
  }
}
</style>
