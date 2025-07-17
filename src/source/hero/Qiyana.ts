function importModule() {
  return {
    type: "hero",
    id: "Qiyana",
    title: "元素女皇",
    name: "奇亚娜",
    avatar: "Qiyana.png",
    skins: [
      { name: "default", skin: "Qiyana_0.jpg" },
      { name: "战场BOSS 奇亚娜", skin: "Qiyana_1.jpg" },
      { name: "真实伤害 奇亚娜", skin: "Qiyana_2.jpg" },
      { name: "至臻 真实伤害 奇亚娜", skin: "Qiyana_10.jpg" },
      { name: "女帝 奇亚娜", skin: "Qiyana_11.jpg" },
      { name: "冲击之刃 奇亚娜", skin: "Qiyana_20.jpg" },
      { name: "至臻 真实伤害 奇亚娜 (2022)", skin: "Qiyana_21.jpg" },
      { name: "春晖神女 奇亚娜", skin: "Qiyana_30.jpg" },
      { name: "灵之菊 奇亚娜", skin: "Qiyana_40.jpg" },
    ],
    spells: [
      { id: "QiyanaP", name: "凌人贵气", icon: "QiyanaP.png", description: "" },
      {
        id: "QiyanaQ",
        name: "元素之怒 / 以绪塔尔之锋",
        icon: "QiyanaQ.png",
        description: "",
      },
      { id: "QiyanaW", name: "方圆塑令", icon: "QiyanaW.png", description: "" },
      { id: "QiyanaE", name: "天纵之勇", icon: "QiyanaE.png", description: "" },
      { id: "QiyanaR", name: "惊才绝景", icon: "QiyanaR.png", description: "" },
    ],
    effects: {
      QiyanaP: null,
      QiyanaQ: null,
      QiyanaW: null,
      QiyanaE: null,
      QiyanaR: null,
    },
  };
}
export { importModule };
