function importModule() {
  return {
    type: "hero",
    id: "Irelia",
    title: "刀锋舞者",
    name: "艾瑞莉娅",
    avatar: "Irelia.png",
    skins: [
      { name: "default", skin: "Irelia_0.jpg" },
      { name: "夜刃 艾瑞莉娅", skin: "Irelia_1.jpg" },
      { name: "凌云之翼 艾瑞莉娅", skin: "Irelia_2.jpg" },
      { name: "夜行义贼 艾瑞莉娅", skin: "Irelia_3.jpg" },
      { name: "冰霜之刃 艾瑞莉娅", skin: "Irelia_4.jpg" },
      { name: "莲花之令 艾瑞莉娅", skin: "Irelia_5.jpg" },
      { name: "玉剑传说 舞剑仙", skin: "Irelia_6.jpg" },
      { name: "iG 艾瑞莉娅", skin: "Irelia_15.jpg" },
      { name: "源计划：正义 艾瑞莉娅", skin: "Irelia_16.jpg" },
      { name: "至臻 源计划：正义 艾瑞莉娅", skin: "Irelia_17.jpg" },
      { name: "西部天使 艾瑞莉娅", skin: "Irelia_18.jpg" },
      { name: "光明哨兵 艾瑞莉娅", skin: "Irelia_26.jpg" },
      { name: "至臻 源计划：正义 艾瑞莉娅 (2022)", skin: "Irelia_36.jpg" },
      { name: "剪纸仙灵 艾瑞莉娅", skin: "Irelia_37.jpg" },
      { name: "青花瓷 艾瑞莉娅", skin: "Irelia_45.jpg" },
    ],
    spells: [
      {
        id: "IreliaP",
        name: "艾欧尼亚热诚",
        icon: "IreliaP.png",
        description: "",
      },
      { id: "IreliaQ", name: "利刃冲击", icon: "IreliaQ.png", description: "" },
      { id: "IreliaW", name: "距破之舞", icon: "IreliaW.png", description: "" },
      { id: "IreliaE", name: "比翼双刃", icon: "IreliaE.png", description: "" },
      { id: "IreliaR", name: "先锋之刃", icon: "IreliaR.png", description: "" },
    ],
    effects: {
      IreliaP: null,
      IreliaQ: null,
      IreliaW: null,
      IreliaE: null,
      IreliaR: null,
    },
  };
}
export { importModule };
