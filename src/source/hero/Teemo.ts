function importModule() {
  return {
    type: "hero",
    id: "Teemo",
    title: "迅捷斥候",
    name: "提莫",
    avatar: "Teemo.png",
    skins: [
      { name: "default", skin: "Teemo_0.jpg" },
      { name: "圣诞开心鬼 提莫", skin: "Teemo_1.jpg" },
      { name: "军情五处 提莫", skin: "Teemo_2.jpg" },
      { name: "密林猎手 提莫", skin: "Teemo_3.jpg" },
      { name: "提莫:'约德尔人的一大步'", skin: "Teemo_4.jpg" },
      { name: "兔宝宝 提莫", skin: "Teemo_5.jpg" },
      { name: "约德尔国队长 提莫", skin: "Teemo_6.jpg" },
      { name: "熊猫 提莫", skin: "Teemo_7.jpg" },
      { name: "欧米伽小队 幽灵特工", skin: "Teemo_8.jpg" },
      { name: "大魔王 提莫", skin: "Teemo_14.jpg" },
      { name: "小蜜蜂 提莫", skin: "Teemo_18.jpg" },
      { name: "灵魂莲华 提莫", skin: "Teemo_25.jpg" },
      { name: "至臻 灵魂莲华 提莫", skin: "Teemo_27.jpg" },
      { name: "招财进宝 提莫", skin: "Teemo_37.jpg" },
      { name: "太空律动 “律动队长” 提莫", skin: "Teemo_47.jpg" },
    ],
    spells: [
      { id: "TeemoP", name: "游击队军备", icon: "TeemoP.png", description: "" },
      { id: "TeemoQ", name: "致盲吹箭", icon: "TeemoQ.png", description: "" },
      { id: "TeemoW", name: "小莫快跑", icon: "TeemoW.png", description: "" },
      { id: "TeemoE", name: "毒性射击", icon: "TeemoE.png", description: "" },
      { id: "TeemoR", name: "种蘑菇", icon: "TeemoR.png", description: "" },
    ],
    effects: {
      TeemoP: null,
      TeemoQ: null,
      TeemoW: null,
      TeemoE: null,
      TeemoR: null,
    },
  };
}
export { importModule };
