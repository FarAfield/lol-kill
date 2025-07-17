function importModule() {
  return {
    type: "hero",
    id: "Kindred",
    title: "永猎双子",
    name: "千珏",
    avatar: "Kindred.png",
    skins: [
      { name: "default", skin: "Kindred_0.jpg" },
      { name: "黯焰双魂 千珏", skin: "Kindred_1.jpg" },
      { name: "银河魔装机神 千珏", skin: "Kindred_2.jpg" },
      { name: "灵魂莲华 千珏", skin: "Kindred_3.jpg" },
      { name: "青花瓷 千珏", skin: "Kindred_12.jpg" },
      { name: "猫狗大战 千珏", skin: "Kindred_22.jpg" },
      { name: "DRX 千珏", skin: "Kindred_23.jpg" },
      { name: "至臻 青花瓷 千珏", skin: "Kindred_33.jpg" },
    ],
    spells: [
      {
        id: "KindredP",
        name: "千珏之印",
        icon: "KindredP.png",
        description: "",
      },
      {
        id: "KindredQ",
        name: "乱箭之舞",
        icon: "KindredQ.png",
        description: "",
      },
      {
        id: "KindredW",
        name: "狼灵狂热",
        icon: "KindredW.png",
        description: "",
      },
      {
        id: "KindredE",
        name: "横生惧意",
        icon: "KindredE.png",
        description: "",
      },
      {
        id: "KindredR",
        name: "羊灵生息",
        icon: "KindredR.png",
        description: "",
      },
    ],
    effects: {
      KindredP: null,
      KindredQ: null,
      KindredW: null,
      KindredE: null,
      KindredR: null,
    },
  };
}
export { importModule };
