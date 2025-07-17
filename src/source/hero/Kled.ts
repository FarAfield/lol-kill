function importModule() {
  return {
    type: "hero",
    id: "Kled",
    title: "暴怒骑士",
    name: "克烈",
    avatar: "Kled.png",
    skins: [
      { name: "default", skin: "Kled_0.jpg" },
      { name: "爵士 克烈", skin: "Kled_1.jpg" },
      { name: "克烈古拉伯爵", skin: "Kled_2.jpg" },
      { name: "黑暗骑士 克烈", skin: "Kled_9.jpg" },
      { name: "狗粮克烈", skin: "Kled_18.jpg" },
    ],
    spells: [
      {
        id: "KledP",
        name: "怯战蜥蜴斯嘎尔",
        icon: "KledP.png",
        description: "",
      },
      { id: "KledQ", name: "飞索捕熊器", icon: "KledQ.png", description: "" },
      { id: "KledW", name: "暴烈秉性", icon: "KledW.png", description: "" },
      { id: "KledE", name: "比武", icon: "KledE.png", description: "" },
      { id: "KledR", name: "冲啊——！！", icon: "KledR.png", description: "" },
    ],
    effects: {
      KledP: null,
      KledQ: null,
      KledW: null,
      KledE: null,
      KledR: null,
    },
  };
}
export { importModule };
