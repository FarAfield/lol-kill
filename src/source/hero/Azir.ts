function importModule() {
  return {
    type: "hero",
    id: "Azir",
    title: "沙漠皇帝",
    name: "阿兹尔",
    avatar: "Azir.png",
    skins: [
      { name: "default", skin: "Azir_0.jpg" },
      { name: "星际之门 阿兹尔", skin: "Azir_1.jpg" },
      { name: "幽冥领主 阿兹尔", skin: "Azir_2.jpg" },
      { name: "SKT T1 阿兹尔", skin: "Azir_3.jpg" },
      { name: "司马懿 仲达", skin: "Azir_4.jpg" },
      { name: "永恒之森 阿兹尔", skin: "Azir_5.jpg" },
      { name: "2022 全球总决赛 阿兹尔", skin: "Azir_14.jpg" },
      { name: "精英律师 阿兹尔", skin: "Azir_19.jpg" },
    ],
    spells: [
      { id: "AzirP", name: "恕瑞玛的传承", icon: "AzirP.png", description: "" },
      { id: "AzirQ", name: "狂沙猛攻", icon: "AzirQ.png", description: "" },
      { id: "AzirW", name: "沙兵现身", icon: "AzirW.png", description: "" },
      { id: "AzirE", name: "流沙移形", icon: "AzirE.png", description: "" },
      { id: "AzirR", name: "禁军之墙", icon: "AzirR.png", description: "" },
    ],
    effects: {
      AzirP: null,
      AzirQ: null,
      AzirW: null,
      AzirE: null,
      AzirR: null,
    },
  };
}
export { importModule };
