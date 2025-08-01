<template>
  <Group :list="list" type="equip" />
</template>
<script setup lang="ts">
import { ref, onMounted } from "vue";
import Group from "@/views/source/components/group.vue";
import { dynamicImportModule } from "@/core/utils";

const list = ref([]);
onMounted(async () => {
  const modules = import.meta.glob("@/source/equip/*.ts");
  for (const path in modules) {
    const packageName = path.split("/").at(-2);
    const fileName = path.split("/").at(-1)?.replace(".ts", "");
    const { importModule } = await dynamicImportModule(packageName!, fileName!);
    const module = importModule();
    list.value = list.value.concat(module);
  }
});
</script>
<style lang="less" scoped></style>
