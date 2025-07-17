function importModule() {
  return {
    type: "hero",
    id: "Nami",
    title: "唤潮鲛姬",
    name: "娜美",
    avatar: "Nami.png",
    skins: [
      { name: "default", skin: "Nami_0.jpg" },
      { name: "锦鲤 娜美", skin: "Nami_1.jpg" },
      { name: "河水之灵 娜美", skin: "Nami_2.jpg" },
      { name: "鲛妮座人 娜美", skin: "Nami_3.jpg" },
      { name: "海皇姬 娜美", skin: "Nami_7.jpg" },
      { name: "SKT T1 娜美", skin: "Nami_8.jpg" },
      { name: "源代码 娜美", skin: "Nami_9.jpg" },
      { name: "玉剑传说 寒潭夭夭", skin: "Nami_15.jpg" },
      { name: "双鱼星神 娜美", skin: "Nami_24.jpg" },
      { name: "魅惑女巫 娜美", skin: "Nami_32.jpg" },
      { name: "太空律动 “魔音海妖” 娜美", skin: "Nami_41.jpg" },
      { name: "至臻 太空律动 “魔音海妖” 娜美", skin: "Nami_42.jpg" },
      { name: "魔女 娜美", skin: "Nami_51.jpg" },
    ],
    spells: [
      { id: "NamiP", name: "踏浪之行", icon: "NamiP.png", description: "" },
      { id: "NamiQ", name: "碧波之牢", icon: "NamiQ.png", description: "" },
      { id: "NamiW", name: "冲击之潮", icon: "NamiW.png", description: "" },
      { id: "NamiE", name: "唤潮之佑", icon: "NamiE.png", description: "" },
      { id: "NamiR", name: "怒涛之啸", icon: "NamiR.png", description: "" },
    ],
    effects: {
      NamiP: null,
      NamiQ: null,
      NamiW: null,
      NamiE: null,
      NamiR: null,
    },
  };
}
export { importModule };
