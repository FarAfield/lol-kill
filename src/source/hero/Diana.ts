function importModule() {
  return {
    type: "hero",
    id: "Diana",
    title: "皎月女神",
    name: "黛安娜",
    avatar: "Diana.png",
    skins: [
      { name: "default", skin: "Diana_0.jpg" },
      { name: "暗黑女武神 黛安娜", skin: "Diana_1.jpg" },
      { name: "广寒仙子 嫦娥", skin: "Diana_2.jpg" },
      { name: "无限烈焰 黛安娜", skin: "Diana_3.jpg" },
      { name: "腥红之月 黛安娜", skin: "Diana_11.jpg" },
      { name: "黑潮 黛安娜", skin: "Diana_12.jpg" },
      { name: "屠龙勇士 黛安娜", skin: "Diana_18.jpg" },
      { name: "女帝 黛安娜", skin: "Diana_25.jpg" },
      { name: "至臻 女帝 黛安娜", skin: "Diana_26.jpg" },
      { name: "光明哨兵 黛安娜", skin: "Diana_27.jpg" },
      { name: "烈焰仙子 黛安娜", skin: "Diana_37.jpg" },
      { name: "北极星神 黛安娜", skin: "Diana_47.jpg" },
      { name: "天龙之子 黛安娜", skin: "Diana_54.jpg" },
      { name: "暗星女王 黛安娜", skin: "Diana_64.jpg" },
      { name: "至臻 暗星女王 黛安娜", skin: "Diana_65.jpg" },
    ],
    spells: [
      { id: "DianaP", name: "月银之刃", icon: "DianaP.png", description: "" },
      { id: "DianaQ", name: "新月打击", icon: "DianaQ.png", description: "" },
      { id: "DianaW", name: "苍白之瀑", icon: "DianaW.png", description: "" },
      { id: "DianaE", name: "月神冲刺", icon: "DianaE.png", description: "" },
      { id: "DianaR", name: "月之降临", icon: "DianaR.png", description: "" },
    ],
    effects: {
      DianaP: null,
      DianaQ: null,
      DianaW: null,
      DianaE: null,
      DianaR: null,
    },
  };
}
export { importModule };
