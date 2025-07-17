function importModule() {
  return {
    type: "hero",
    id: "Fiora",
    title: "无双剑姬",
    name: "菲奥娜",
    avatar: "Fiora.png",
    skins: [
      { name: "default", skin: "Fiora_0.jpg" },
      { name: "皇家守卫 菲奥娜", skin: "Fiora_1.jpg" },
      { name: "夜鸦 菲奥娜", skin: "Fiora_2.jpg" },
      { name: "女校长 菲奥娜", skin: "Fiora_3.jpg" },
      { name: "源计划：火 菲奥娜", skin: "Fiora_4.jpg" },
      { name: "泳池派对 菲奥娜", skin: "Fiora_5.jpg" },
      { name: "玉剑传说 无双", skin: "Fiora_22.jpg" },
      { name: "穿心之剑 菲奥娜", skin: "Fiora_23.jpg" },
      { name: "iG 菲奥娜", skin: "Fiora_31.jpg" },
      { name: "未来战士 菲奥娜", skin: "Fiora_41.jpg" },
      { name: "福牛守护者 菲奥娜", skin: "Fiora_50.jpg" },
      { name: "至臻 福牛守护者 菲奥娜", skin: "Fiora_51.jpg" },
      { name: "魅惑女巫 菲奥娜", skin: "Fiora_60.jpg" },
      { name: "花仙骑士 菲奥娜", skin: "Fiora_69.jpg" },
      { name: "神龙尊者 无双之龙 菲奥娜", skin: "Fiora_80.jpg" },
      { name: "女帝 菲奥娜", skin: "Fiora_89.jpg" },
    ],
    spells: [
      { id: "FioraP", name: "决斗之舞", icon: "FioraP.png", description: "" },
      { id: "FioraQ", name: "破空斩", icon: "FioraQ.png", description: "" },
      {
        id: "FioraW",
        name: "劳伦特心眼刀",
        icon: "FioraW.png",
        description: "",
      },
      { id: "FioraE", name: "夺命连刺", icon: "FioraE.png", description: "" },
      { id: "FioraR", name: "无双挑战", icon: "FioraR.png", description: "" },
    ],
    effects: {
      FioraP: null,
      FioraQ: null,
      FioraW: null,
      FioraE: null,
      FioraR: null,
    },
  };
}
export { importModule };
