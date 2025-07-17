function importModule() {
  return {
    type: "hero",
    id: "Taliyah",
    title: "岩雀",
    name: "塔莉垭",
    avatar: "Taliyah.png",
    skins: [
      { name: "default", skin: "Taliyah_0.jpg" },
      { name: "弗雷尔卓德 塔莉垭", skin: "Taliyah_1.jpg" },
      { name: "SSG 塔莉垭", skin: "Taliyah_2.jpg" },
      { name: "泳池派对 塔莉垭", skin: "Taliyah_3.jpg" },
      { name: "星之守护者 塔莉垭", skin: "Taliyah_11.jpg" },
      { name: "水晶圣骑 塔莉垭", skin: "Taliyah_21.jpg" },
    ],
    spells: [
      { id: "TaliyahP", name: "浮石冲", icon: "TaliyahP.png", description: "" },
      { id: "TaliyahQ", name: "石穿", icon: "TaliyahQ.png", description: "" },
      { id: "TaliyahW", name: "岩突", icon: "TaliyahW.png", description: "" },
      { id: "TaliyahE", name: "撒石阵", icon: "TaliyahE.png", description: "" },
      { id: "TaliyahR", name: "墙幔", icon: "TaliyahR.png", description: "" },
    ],
    effects: {
      TaliyahP: null,
      TaliyahQ: null,
      TaliyahW: null,
      TaliyahE: null,
      TaliyahR: null,
    },
  };
}
export { importModule };
