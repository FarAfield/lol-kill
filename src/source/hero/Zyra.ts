function importModule() {
  return {
    type: "hero",
    id: "Zyra",
    title: "荆棘之兴",
    name: "婕拉",
    avatar: "Zyra.png",
    skins: [
      { name: "default", skin: "Zyra_0.jpg" },
      { name: "野火之藤 婕拉", skin: "Zyra_1.jpg" },
      { name: "鬼影森森 婕拉", skin: "Zyra_2.jpg" },
      { name: "SKT T1 婕拉", skin: "Zyra_3.jpg" },
      { name: "驯龙女巫 婕拉", skin: "Zyra_4.jpg" },
      { name: "魔女 婕拉", skin: "Zyra_5.jpg" },
      { name: "至臻 魔女 婕拉", skin: "Zyra_6.jpg" },
      { name: "水晶玫瑰 婕拉", skin: "Zyra_7.jpg" },
      { name: "地下都市 梦魇 婕拉", skin: "Zyra_16.jpg" },
      { name: "剪纸仙灵 婕拉", skin: "Zyra_36.jpg" },
      { name: "妖怪艺术家 婕拉", skin: "Zyra_46.jpg" },
      { name: "腥红之月 婕拉", skin: "Zyra_55.jpg" },
    ],
    spells: [
      { id: "ZyraP", name: "荆棘花园", icon: "ZyraP.png", description: "" },
      { id: "ZyraQ", name: "致命棘刺", icon: "ZyraQ.png", description: "" },
      { id: "ZyraW", name: "狂野生长", icon: "ZyraW.png", description: "" },
      { id: "ZyraE", name: "缠绕之根", icon: "ZyraE.png", description: "" },
      { id: "ZyraR", name: "绞杀之藤", icon: "ZyraR.png", description: "" },
    ],
    effects: {
      ZyraP: null,
      ZyraQ: null,
      ZyraW: null,
      ZyraE: null,
      ZyraR: null,
    },
  };
}
export { importModule };
