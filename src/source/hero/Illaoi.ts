function importModule() {
  return {
    type: "hero",
    id: "Illaoi",
    title: "海兽祭司",
    name: "俄洛伊",
    avatar: "Illaoi.png",
    skins: [
      { name: "default", skin: "Illaoi_0.jpg" },
      { name: "虚空使者 俄洛伊", skin: "Illaoi_1.jpg" },
      { name: "抵抗军炎魔 俄洛伊", skin: "Illaoi_2.jpg" },
      { name: "水瓶星神 俄洛伊", skin: "Illaoi_10.jpg" },
      { name: "净雪之月 俄洛伊", skin: "Illaoi_18.jpg" },
      { name: "幻灵巨熊 俄洛伊", skin: "Illaoi_27.jpg" },
    ],
    spells: [
      { id: "IllaoiP", name: "古神先知", icon: "IllaoiP.png", description: "" },
      { id: "IllaoiQ", name: "触手猛击", icon: "IllaoiQ.png", description: "" },
      { id: "IllaoiW", name: "严酷训诫", icon: "IllaoiW.png", description: "" },
      { id: "IllaoiE", name: "灵魂试炼", icon: "IllaoiE.png", description: "" },
      { id: "IllaoiR", name: "过界信仰", icon: "IllaoiR.png", description: "" },
    ],
    effects: {
      IllaoiP: null,
      IllaoiQ: null,
      IllaoiW: null,
      IllaoiE: null,
      IllaoiR: null,
    },
  };
}
export { importModule };
