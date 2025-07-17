function importModule() {
  return {
    type: "hero",
    id: "Yuumi",
    title: "魔法猫咪",
    name: "悠米",
    avatar: "Yuumi.png",
    skins: [
      { name: "default", skin: "Yuumi_0.jpg" },
      { name: "战斗校长 悠米", skin: "Yuumi_1.jpg" },
      { name: "觅心猫猫 悠米", skin: "Yuumi_11.jpg" },
      { name: "小蜜蜂 悠米", skin: "Yuumi_19.jpg" },
      { name: "魅惑女巫 悠米", skin: "Yuumi_28.jpg" },
      { name: "EDG 悠米", skin: "Yuumi_37.jpg" },
      { name: "狗头猫咪 悠米", skin: "Yuumi_39.jpg" },
      { name: "人工智能 悠米", skin: "Yuumi_49.jpg" },
      { name: "至臻 人工智能 悠米", skin: "Yuumi_50.jpg" },
    ],
    spells: [
      { id: "YuumiP", name: "猫的博爱", icon: "YuumiP.png", description: "" },
      { id: "YuumiQ", name: "摸鱼飞弹", icon: "YuumiQ.png", description: "" },
      { id: "YuumiW", name: "悠米出动！", icon: "YuumiW.png", description: "" },
      { id: "YuumiE", name: "旺盛精力", icon: "YuumiE.png", description: "" },
      { id: "YuumiR", name: "魔典终章", icon: "YuumiR.png", description: "" },
    ],
    effects: {
      YuumiP: null,
      YuumiQ: null,
      YuumiW: null,
      YuumiE: null,
      YuumiR: null,
    },
  };
}
export { importModule };
