function importModule() {
  return {
    type: "hero",
    id: "Ekko",
    title: "时间刺客",
    name: "艾克",
    avatar: "Ekko.png",
    skins: [
      { name: "default", skin: "Ekko_0.jpg" },
      { name: "时之砂 艾克", skin: "Ekko_1.jpg" },
      { name: "任性学霸 艾克", skin: "Ekko_2.jpg" },
      { name: "源计划：自由 艾克", skin: "Ekko_3.jpg" },
      { name: "SKT T1 艾克", skin: "Ekko_11.jpg" },
      { name: "不给糖就捣蛋 艾克", skin: "Ekko_12.jpg" },
      { name: "真实伤害 艾克", skin: "Ekko_19.jpg" },
      { name: "未来战士 艾克", skin: "Ekko_28.jpg" },
      { name: "野火首领 艾克", skin: "Ekko_36.jpg" },
      { name: "星之守护者 艾克", skin: "Ekko_45.jpg" },
      { name: "至臻 星之守护者 艾克", skin: "Ekko_46.jpg" },
      { name: "真实伤害 突破界限 艾克", skin: "Ekko_56.jpg" },
    ],
    spells: [
      { id: "EkkoP", name: "Z型驱动共振", icon: "EkkoP.png", description: "" },
      { id: "EkkoQ", name: "时间卷曲器", icon: "EkkoQ.png", description: "" },
      { id: "EkkoW", name: "时光交错", icon: "EkkoW.png", description: "" },
      { id: "EkkoE", name: "相位俯冲", icon: "EkkoE.png", description: "" },
      { id: "EkkoR", name: "时空断裂", icon: "EkkoR.png", description: "" },
    ],
    effects: {
      EkkoP: null,
      EkkoQ: null,
      EkkoW: null,
      EkkoE: null,
      EkkoR: null,
    },
  };
}
export { importModule };
