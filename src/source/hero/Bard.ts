function importModule() {
  return {
    type: "hero",
    id: "Bard",
    title: "星界游神",
    name: "巴德",
    avatar: "Bard.png",
    skins: [
      { name: "default", skin: "Bard_0.jpg" },
      { name: "永恒之森 巴德", skin: "Bard_1.jpg" },
      { name: "冰雪游神 巴德", skin: "Bard_5.jpg" },
      { name: "巴德·吟游诗人", skin: "Bard_6.jpg" },
      { name: "宇航员 巴德", skin: "Bard_8.jpg" },
      { name: "咖啡甜心 巴德", skin: "Bard_17.jpg" },
      { name: "山海绘卷 巴德", skin: "Bard_26.jpg" },
      { name: "T1 巴德", skin: "Bard_35.jpg" },
    ],
    spells: [
      { id: "BardP", name: "旅者的召唤", icon: "BardP.png", description: "" },
      { id: "BardQ", name: "星界束缚", icon: "BardQ.png", description: "" },
      { id: "BardW", name: "游神圣坛", icon: "BardW.png", description: "" },
      { id: "BardE", name: "神奇旅程", icon: "BardE.png", description: "" },
      { id: "BardR", name: "调和命运", icon: "BardR.png", description: "" },
    ],
    effects: {
      BardP: null,
      BardQ: null,
      BardW: null,
      BardE: null,
      BardR: null,
    },
  };
}
export { importModule };
