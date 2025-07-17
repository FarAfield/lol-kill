function importModule() {
  return {
    type: "hero",
    id: "Alistar",
    title: "牛头酋长",
    name: "阿利斯塔",
    avatar: "Alistar.png",
    skins: [
      { name: "default", skin: "Alistar_0.jpg" },
      { name: "暗黑灵魂 阿利斯塔", skin: "Alistar_1.jpg" },
      { name: "金牛座 阿利斯塔", skin: "Alistar_2.jpg" },
      { name: "斗牛士 阿利斯塔", skin: "Alistar_3.jpg" },
      { name: "荒野镖客 阿利斯塔", skin: "Alistar_4.jpg" },
      { name: "巨角幻兽 阿利斯塔", skin: "Alistar_5.jpg" },
      { name: "地狱火 阿利斯塔", skin: "Alistar_6.jpg" },
      { name: "后场堡垒 阿利斯塔", skin: "Alistar_7.jpg" },
      { name: "黑暗骑士 阿利斯塔", skin: "Alistar_8.jpg" },
      { name: "SKT T1 阿利斯塔", skin: "Alistar_9.jpg" },
      { name: "哞利斯塔", skin: "Alistar_10.jpg" },
      { name: "海克斯科技 阿利斯塔", skin: "Alistar_19.jpg" },
      { name: "征服者 阿利斯塔", skin: "Alistar_20.jpg" },
      { name: "黯晶巨牛 阿利斯塔", skin: "Alistar_22.jpg" },
      { name: "福牛守护者 阿利斯塔", skin: "Alistar_29.jpg" },
    ],
    spells: [
      {
        id: "AlistarP",
        name: "凯旋怒吼",
        icon: "AlistarP.png",
        description: "",
      },
      {
        id: "AlistarQ",
        name: "大地粉碎",
        icon: "AlistarQ.png",
        description: "",
      },
      {
        id: "AlistarW",
        name: "野蛮冲撞",
        icon: "AlistarW.png",
        description: "",
      },
      { id: "AlistarE", name: "践踏", icon: "AlistarE.png", description: "" },
      {
        id: "AlistarR",
        name: "坚定意志",
        icon: "AlistarR.png",
        description: "",
      },
    ],
    effects: {
      AlistarP: null,
      AlistarQ: null,
      AlistarW: null,
      AlistarE: null,
      AlistarR: null,
    },
  };
}
export { importModule };
