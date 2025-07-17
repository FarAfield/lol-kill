function importModule() {
  return {
    type: "hero",
    id: "Karthus",
    title: "死亡颂唱者",
    name: "卡尔萨斯",
    avatar: "Karthus.png",
    skins: [
      { name: "default", skin: "Karthus_0.jpg" },
      { name: "幽灵幻影 卡尔萨斯", skin: "Karthus_1.jpg" },
      { name: "自由女神 卡尔萨斯", skin: "Karthus_2.jpg" },
      { name: "死神 卡尔萨斯", skin: "Karthus_3.jpg" },
      { name: "五杀摇滚主唱 卡尔萨斯", skin: "Karthus_4.jpg" },
      { name: "Fnatic 卡尔萨斯", skin: "Karthus_5.jpg" },
      { name: "卡尔萨斯·祸害之光", skin: "Karthus_9.jpg" },
      { name: "地狱火 卡尔萨斯", skin: "Karthus_10.jpg" },
      { name: "五杀摇滚 III：遗失的章节 卡尔萨斯", skin: "Karthus_17.jpg" },
      { name: "永恒之森 卡尔萨斯", skin: "Karthus_26.jpg" },
    ],
    spells: [
      {
        id: "KarthusP",
        name: "死亡契约",
        icon: "KarthusP.png",
        description: "",
      },
      { id: "KarthusQ", name: "荒芜", icon: "KarthusQ.png", description: "" },
      {
        id: "KarthusW",
        name: "痛苦之墙",
        icon: "KarthusW.png",
        description: "",
      },
      { id: "KarthusE", name: "亵渎", icon: "KarthusE.png", description: "" },
      { id: "KarthusR", name: "安魂曲", icon: "KarthusR.png", description: "" },
    ],
    effects: {
      KarthusP: null,
      KarthusQ: null,
      KarthusW: null,
      KarthusE: null,
      KarthusR: null,
    },
  };
}
export { importModule };
