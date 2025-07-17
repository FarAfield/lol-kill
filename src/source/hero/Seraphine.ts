function importModule() {
  return {
    type: "hero",
    id: "Seraphine",
    title: "星籁歌姬",
    name: "萨勒芬妮",
    avatar: "Seraphine.png",
    skins: [
      { name: "default", skin: "Seraphine_0.jpg" },
      { name: "K/DA ALL OUT 萨勒芬妮 独立音乐人", skin: "Seraphine_1.jpg" },
      { name: "K/DA ALL OUT 萨勒芬妮 明日新星", skin: "Seraphine_2.jpg" },
      { name: "K/DA ALL OUT 萨勒芬妮 超级巨星", skin: "Seraphine_3.jpg" },
      { name: "神凰行者 幽羽玄凰 萨勒芬妮", skin: "Seraphine_4.jpg" },
      { name: "海之歌 萨勒芬妮", skin: "Seraphine_14.jpg" },
      { name: "至臻 海之歌 萨勒芬妮", skin: "Seraphine_15.jpg" },
      { name: "花仙子 萨勒芬妮", skin: "Seraphine_24.jpg" },
      { name: "星之守护者 萨勒芬妮", skin: "Seraphine_34.jpg" },
      { name: "幻灵白鸽 萨勒芬妮", skin: "Seraphine_43.jpg" },
    ],
    spells: [
      {
        id: "SeraphineP",
        name: "星光漫射",
        icon: "SeraphineP.png",
        description: "",
      },
      {
        id: "SeraphineQ",
        name: "清籁穿云",
        icon: "SeraphineQ.png",
        description: "",
      },
      {
        id: "SeraphineW",
        name: "聚和心声",
        icon: "SeraphineW.png",
        description: "",
      },
      {
        id: "SeraphineE",
        name: "增幅节拍",
        icon: "SeraphineE.png",
        description: "",
      },
      {
        id: "SeraphineR",
        name: "炫音返场",
        icon: "SeraphineR.png",
        description: "",
      },
    ],
    effects: {
      SeraphineP: null,
      SeraphineQ: null,
      SeraphineW: null,
      SeraphineE: null,
      SeraphineR: null,
    },
  };
}
export { importModule };
