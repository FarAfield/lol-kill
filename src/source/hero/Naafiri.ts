function importModule() {
  return {
    type: "hero",
    id: "Naafiri",
    title: "百裂冥犬",
    name: "纳亚菲利",
    avatar: "Naafiri.png",
    skins: [
      { name: "default", skin: "Naafiri_0.jpg" },
      { name: "斗魂觉醒 纳亚菲利", skin: "Naafiri_1.jpg" },
      { name: "源计划：狂猎 纳亚菲利", skin: "Naafiri_11.jpg" },
    ],
    spells: [
      {
        id: "NaafiriP",
        name: "狂烈种群",
        icon: "NaafiriP.png",
        description: "",
      },
      {
        id: "NaafiriQ",
        name: "暗裔犬牙",
        icon: "NaafiriQ.png",
        description: "",
      },
      {
        id: "NaafiriW",
        name: "猎狗血性",
        icon: "NaafiriW.png",
        description: "",
      },
      {
        id: "NaafiriE",
        name: "剔骨本能",
        icon: "NaafiriE.png",
        description: "",
      },
      { id: "NaafiriR", name: "暴吼", icon: "NaafiriR.png", description: "" },
    ],
    effects: {
      NaafiriP: null,
      NaafiriQ: null,
      NaafiriW: null,
      NaafiriE: null,
      NaafiriR: null,
    },
  };
}
export { importModule };
