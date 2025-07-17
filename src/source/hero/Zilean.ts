function importModule() {
  return {
    type: "hero",
    id: "Zilean",
    title: "时光守护者",
    name: "基兰",
    avatar: "Zilean.png",
    skins: [
      { name: "default", skin: "Zilean_0.jpg" },
      { name: "圣诞狂欢 基兰", skin: "Zilean_1.jpg" },
      { name: "嘻哈精神 基兰", skin: "Zilean_2.jpg" },
      { name: "遗迹守护者 基兰", skin: "Zilean_3.jpg" },
      { name: "时间机器 基兰", skin: "Zilean_4.jpg" },
      { name: "腥红之月 基兰", skin: "Zilean_5.jpg" },
      { name: "糖果大战 基兰", skin: "Zilean_6.jpg" },
      { name: "北极星圣贤 基兰", skin: "Zilean_14.jpg" },
    ],
    spells: [
      { id: "ZileanP", name: "瓶中时光", icon: "ZileanP.png", description: "" },
      { id: "ZileanQ", name: "定时炸弹", icon: "ZileanQ.png", description: "" },
      { id: "ZileanW", name: "穿梭未来", icon: "ZileanW.png", description: "" },
      { id: "ZileanE", name: "时光发条", icon: "ZileanE.png", description: "" },
      { id: "ZileanR", name: "时光倒流", icon: "ZileanR.png", description: "" },
    ],
    effects: {
      ZileanP: null,
      ZileanQ: null,
      ZileanW: null,
      ZileanE: null,
      ZileanR: null,
    },
  };
}
export { importModule };
