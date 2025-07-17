function importModule() {
  return {
    type: "hero",
    id: "Urgot",
    title: "无畏战车",
    name: "厄加特",
    avatar: "Urgot.png",
    skins: [
      { name: "default", skin: "Urgot_0.jpg" },
      { name: "深渊巨蟹 厄加特", skin: "Urgot_1.jpg" },
      { name: "电锯狂人 厄加特", skin: "Urgot_2.jpg" },
      { name: "战地机甲 厄加特", skin: "Urgot_3.jpg" },
      { name: "西部魔影 厄加特", skin: "Urgot_9.jpg" },
      { name: "星之守护者COS 厄加特", skin: "Urgot_15.jpg" },
      { name: "魔域梦魇 厄加特", skin: "Urgot_23.jpg" },
    ],
    spells: [
      { id: "UrgotP", name: "回响烈焰", icon: "UrgotP.png", description: "" },
      { id: "UrgotQ", name: "腐蚀电荷", icon: "UrgotQ.png", description: "" },
      { id: "UrgotW", name: "净除", icon: "UrgotW.png", description: "" },
      { id: "UrgotE", name: "鄙弃", icon: "UrgotE.png", description: "" },
      {
        id: "UrgotR",
        name: "超越死亡的恐惧",
        icon: "UrgotR.png",
        description: "",
      },
    ],
    effects: {
      UrgotP: null,
      UrgotQ: null,
      UrgotW: null,
      UrgotE: null,
      UrgotR: null,
    },
  };
}
export { importModule };
