function importModule() {
  return {
    type: "hero",
    id: "Aphelios",
    title: "残月之肃",
    name: "厄斐琉斯",
    avatar: "Aphelios.png",
    skins: [
      { name: "default", skin: "Aphelios_0.jpg" },
      { name: "黑夜使者 厄斐琉斯", skin: "Aphelios_1.jpg" },
      { name: "福牛守护者 厄斐琉斯", skin: "Aphelios_9.jpg" },
      { name: "EDG 厄斐琉斯", skin: "Aphelios_18.jpg" },
      { name: "灵魂莲华 厄斐琉斯", skin: "Aphelios_20.jpg" },
      { name: "心之钢 厄斐琉斯", skin: "Aphelios_30.jpg" },
    ],
    spells: [
      {
        id: "ApheliosP",
        name: "传知者与真知者",
        icon: "ApheliosP.png",
        description: "",
      },
      {
        id: "ApheliosQ",
        name: "武器技能",
        icon: "ApheliosQ.png",
        description: "",
      },
      {
        id: "ApheliosW",
        name: "月相轮转",
        icon: "ApheliosW.png",
        description: "",
      },
      {
        id: "ApheliosE",
        name: "武器队列系统",
        icon: "ApheliosE.png",
        description: "",
      },
      {
        id: "ApheliosR",
        name: "清辉夜凝",
        icon: "ApheliosR.png",
        description: "",
      },
    ],
    effects: {
      ApheliosP: null,
      ApheliosQ: null,
      ApheliosW: null,
      ApheliosE: null,
      ApheliosR: null,
    },
  };
}
export { importModule };
