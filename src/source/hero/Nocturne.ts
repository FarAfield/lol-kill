function importModule() {
  return {
    type: "hero",
    id: "Nocturne",
    title: "永恒梦魇",
    name: "魔腾",
    avatar: "Nocturne.png",
    skins: [
      { name: "default", skin: "Nocturne_0.jpg" },
      { name: "蓝焰梦魔 魔腾", skin: "Nocturne_1.jpg" },
      { name: "幻影梦魔 魔腾", skin: "Nocturne_2.jpg" },
      { name: "劫掠梦魇 魔腾", skin: "Nocturne_3.jpg" },
      { name: "鬼影重重 魔腾", skin: "Nocturne_4.jpg" },
      { name: "上古战魂 魔腾", skin: "Nocturne_5.jpg" },
      { name: "恶咒亡魂 魔腾", skin: "Nocturne_6.jpg" },
      { name: "古神 魔腾", skin: "Nocturne_7.jpg" },
      { name: "海克斯科技 魔腾", skin: "Nocturne_16.jpg" },
      { name: "绝息圣堂 魔腾", skin: "Nocturne_17.jpg" },
      { name: "至高天 魔腾", skin: "Nocturne_26.jpg" },
    ],
    spells: [
      {
        id: "NocturneP",
        name: "暗影之刃",
        icon: "NocturneP.png",
        description: "",
      },
      {
        id: "NocturneQ",
        name: "梦魇之径",
        icon: "NocturneQ.png",
        description: "",
      },
      {
        id: "NocturneW",
        name: "黑暗庇护",
        icon: "NocturneW.png",
        description: "",
      },
      {
        id: "NocturneE",
        name: "无言恐惧",
        icon: "NocturneE.png",
        description: "",
      },
      {
        id: "NocturneR",
        name: "鬼影重重",
        icon: "NocturneR.png",
        description: "",
      },
    ],
    effects: {
      NocturneP: null,
      NocturneQ: null,
      NocturneW: null,
      NocturneE: null,
      NocturneR: null,
    },
  };
}
export { importModule };
