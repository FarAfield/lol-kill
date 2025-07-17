function importModule() {
  return {
    type: "hero",
    id: "Hecarim",
    title: "战争之影",
    name: "赫卡里姆",
    avatar: "Hecarim.png",
    skins: [
      { name: "default", skin: "Hecarim_0.jpg" },
      { name: "血石骑士 赫卡里姆", skin: "Hecarim_1.jpg" },
      { name: "幽魂骑士 赫卡里姆", skin: "Hecarim_2.jpg" },
      { name: "无头骑士 赫卡里姆", skin: "Hecarim_3.jpg" },
      { name: "电玩战魂 赫卡里姆", skin: "Hecarim_4.jpg" },
      { name: "永恒之森 赫卡里姆", skin: "Hecarim_5.jpg" },
      { name: "创世之神 赫卡里姆", skin: "Hecarim_6.jpg" },
      { name: "零之枪骑 赫卡里姆", skin: "Hecarim_7.jpg" },
      { name: "西部魔影 赫卡里姆", skin: "Hecarim_8.jpg" },
      { name: "人马星神 赫卡里姆", skin: "Hecarim_14.jpg" },
      { name: "车骑之力 赫卡里姆", skin: "Hecarim_22.jpg" },
      { name: "北极星守护者 赫卡里姆", skin: "Hecarim_31.jpg" },
    ],
    spells: [
      {
        id: "HecarimP",
        name: "征战之路",
        icon: "HecarimP.png",
        description: "",
      },
      { id: "HecarimQ", name: "暴走", icon: "HecarimQ.png", description: "" },
      {
        id: "HecarimW",
        name: "恐惧之灵",
        icon: "HecarimW.png",
        description: "",
      },
      {
        id: "HecarimE",
        name: "毁灭冲锋",
        icon: "HecarimE.png",
        description: "",
      },
      {
        id: "HecarimR",
        name: "暗影冲击",
        icon: "HecarimR.png",
        description: "",
      },
    ],
    effects: {
      HecarimP: null,
      HecarimQ: null,
      HecarimW: null,
      HecarimE: null,
      HecarimR: null,
    },
  };
}
export { importModule };
