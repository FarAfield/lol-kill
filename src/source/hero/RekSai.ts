function importModule() {
  return {
    type: "hero",
    id: "RekSai",
    title: "虚空遁地兽",
    name: "雷克塞",
    avatar: "RekSai.png",
    skins: [
      { name: "default", skin: "RekSai_0.jpg" },
      { name: "上古战魂 雷克塞", skin: "RekSai_1.jpg" },
      { name: "泳池派对 雷克塞", skin: "RekSai_2.jpg" },
      { name: "黯晶巨兽 雷克塞", skin: "RekSai_9.jpg" },
      { name: "永恒之森 雷克塞", skin: "RekSai_17.jpg" },
      { name: "海魔兽 雷克塞", skin: "RekSai_26.jpg" },
    ],
    spells: [
      {
        id: "RekSaiP",
        name: "艾克塞之怒",
        icon: "RekSaiP.png",
        description: "",
      },
      {
        id: "RekSaiQ",
        name: "女王之怒 / 猎物搜寻",
        icon: "RekSaiQ.png",
        description: "",
      },
      {
        id: "RekSaiW",
        name: "遁地 / 破土而出",
        icon: "RekSaiW.png",
        description: "",
      },
      {
        id: "RekSaiE",
        name: "狂野之噬 / 挖掘隧道",
        icon: "RekSaiE.png",
        description: "",
      },
      { id: "RekSaiR", name: "虚空猛冲", icon: "RekSaiR.png", description: "" },
    ],
    effects: {
      RekSaiP: null,
      RekSaiQ: null,
      RekSaiW: null,
      RekSaiE: null,
      RekSaiR: null,
    },
  };
}
export { importModule };
