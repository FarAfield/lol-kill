function importModule() {
  return {
    type: "hero",
    id: "Kaisa",
    title: "虚空之女",
    name: "卡莎",
    avatar: "Kaisa.png",
    skins: [
      { name: "default", skin: "Kaisa_0.jpg" },
      { name: "弹幕天使 卡莎", skin: "Kaisa_1.jpg" },
      { name: "K/DA 卡莎", skin: "Kaisa_14.jpg" },
      { name: "至臻 K/DA 卡莎", skin: "Kaisa_15.jpg" },
      { name: "iG 卡莎", skin: "Kaisa_16.jpg" },
      { name: "电玩女神 卡莎", skin: "Kaisa_17.jpg" },
      { name: "K/DA ALL OUT 卡莎", skin: "Kaisa_26.jpg" },
      { name: "至臻 K/DA ALL OUT 卡莎", skin: "Kaisa_27.jpg" },
      { name: "神龙尊者 玉境灵龙 卡莎", skin: "Kaisa_29.jpg" },
      { name: "至臻 K/DA 卡莎 (2022)", skin: "Kaisa_39.jpg" },
      { name: "星之守护者 卡莎", skin: "Kaisa_40.jpg" },
      { name: "墨之影武者 卡莎", skin: "Kaisa_48.jpg" },
      { name: "天龙之子 卡莎", skin: "Kaisa_59.jpg" },
      { name: "暗星 卡莎", skin: "Kaisa_69.jpg" },
    ],
    spells: [
      { id: "KaisaP", name: "体表活肤", icon: "KaisaP.png", description: "" },
      {
        id: "KaisaQ",
        name: "艾卡西亚暴雨",
        icon: "KaisaQ.png",
        description: "",
      },
      { id: "KaisaW", name: "虚空索敌", icon: "KaisaW.png", description: "" },
      { id: "KaisaE", name: "极限超载", icon: "KaisaE.png", description: "" },
      { id: "KaisaR", name: "猎手本能", icon: "KaisaR.png", description: "" },
    ],
    effects: {
      KaisaP: null,
      KaisaQ: null,
      KaisaW: null,
      KaisaE: null,
      KaisaR: null,
    },
  };
}
export { importModule };
