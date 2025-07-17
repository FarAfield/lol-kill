function importModule() {
  return {
    type: "hero",
    id: "Lulu",
    title: "仙灵女巫",
    name: "璐璐",
    avatar: "Lulu.png",
    skins: [
      { name: "default", skin: "Lulu_0.jpg" },
      { name: "糖果女巫 璐璐", skin: "Lulu_1.jpg" },
      { name: "邪恶女巫 璐璐", skin: "Lulu_2.jpg" },
      { name: "驯龙女巫 璐璐", skin: "Lulu_3.jpg" },
      { name: "寒冬精灵 璐璐", skin: "Lulu_4.jpg" },
      { name: "泳池派对 璐璐", skin: "Lulu_5.jpg" },
      { name: "星之守护者 璐璐", skin: "Lulu_6.jpg" },
      { name: "创星之灵 璐璐", skin: "Lulu_14.jpg" },
      { name: "睡衣守护者 璐璐", skin: "Lulu_15.jpg" },
      { name: "太空律动 “节奏幻师” 璐璐", skin: "Lulu_26.jpg" },
      { name: "至臻 太空律动 “节奏幻师” 璐璐", skin: "Lulu_27.jpg" },
      { name: "小怪兽训练师 璐璐", skin: "Lulu_37.jpg" },
      { name: "咖啡甜心 璐璐", skin: "Lulu_46.jpg" },
    ],
    spells: [
      {
        id: "LuluP",
        name: "皮克斯，仙灵伙伴",
        icon: "LuluP.png",
        description: "",
      },
      { id: "LuluQ", name: "闪耀长枪", icon: "LuluQ.png", description: "" },
      { id: "LuluW", name: "奇思妙想", icon: "LuluW.png", description: "" },
      {
        id: "LuluE",
        name: "帮忙，皮克斯！",
        icon: "LuluE.png",
        description: "",
      },
      { id: "LuluR", name: "狂野生长", icon: "LuluR.png", description: "" },
    ],
    effects: {
      LuluP: null,
      LuluQ: null,
      LuluW: null,
      LuluE: null,
      LuluR: null,
    },
  };
}
export { importModule };
