function importModule() {
  return {
    type: "hero",
    id: "AurelionSol",
    title: "铸星龙王",
    name: "奥瑞利安·索尔",
    avatar: "AurelionSol.png",
    skins: [
      { name: "default", skin: "AurelionSol_0.jpg" },
      { name: "灰烬领主 奥瑞利安·索尔", skin: "AurelionSol_1.jpg" },
      { name: "霸天龙神 奥瑞利安 · 索尔", skin: "AurelionSol_2.jpg" },
      { name: "圣龙 奥瑞利安 · 索尔", skin: "AurelionSol_11.jpg" },
      { name: "墨影之灵 奥瑞利安 · 索尔", skin: "AurelionSol_21.jpg" },
      { name: "青花瓷 奥瑞利安 · 索尔", skin: "AurelionSol_31.jpg" },
    ],
    spells: [
      {
        id: "AurelionSolP",
        name: "星海焕然",
        icon: "AurelionSolP.png",
        description: "",
      },
      {
        id: "AurelionSolQ",
        name: "星河冲荡",
        icon: "AurelionSolQ.png",
        description: "",
      },
      {
        id: "AurelionSolW",
        name: "星穹流丽",
        icon: "AurelionSolW.png",
        description: "",
      },
      {
        id: "AurelionSolE",
        name: "星芒凝汇",
        icon: "AurelionSolE.png",
        description: "",
      },
      {
        id: "AurelionSolR",
        name: "星天落瀑",
        icon: "AurelionSolR.png",
        description: "",
      },
    ],
    effects: {
      AurelionSolP: null,
      AurelionSolQ: null,
      AurelionSolW: null,
      AurelionSolE: null,
      AurelionSolR: null,
    },
  };
}
export { importModule };
