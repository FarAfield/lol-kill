function importModule() {
  return {
    type: "hero",
    id: "Chogath",
    title: "虚空恐惧",
    name: "科加斯",
    avatar: "Chogath.png",
    skins: [
      { name: "default", skin: "Chogath_0.jpg" },
      { name: "梦魇 科加斯", skin: "Chogath_1.jpg" },
      { name: "绅士 科加斯", skin: "Chogath_2.jpg" },
      { name: "尼斯巨兽 科加斯", skin: "Chogath_3.jpg" },
      { name: "侏罗纪化石 科加斯", skin: "Chogath_4.jpg" },
      { name: "战地巨兽 科加斯", skin: "Chogath_5.jpg" },
      { name: "暴龙 科加斯", skin: "Chogath_6.jpg" },
      { name: "暗星 科加斯", skin: "Chogath_7.jpg" },
      { name: "山海绘卷 科加斯", skin: "Chogath_14.jpg" },
      { name: "绝息圣堂 科加斯", skin: "Chogath_23.jpg" },
      { name: "鳄加斯", skin: "Chogath_32.jpg" },
    ],
    spells: [
      { id: "ChogathP", name: "肉食者", icon: "ChogathP.png", description: "" },
      { id: "ChogathQ", name: "破裂", icon: "ChogathQ.png", description: "" },
      {
        id: "ChogathW",
        name: "野性尖叫",
        icon: "ChogathW.png",
        description: "",
      },
      {
        id: "ChogathE",
        name: "恐惧之刺",
        icon: "ChogathE.png",
        description: "",
      },
      { id: "ChogathR", name: "盛宴", icon: "ChogathR.png", description: "" },
    ],
    effects: {
      ChogathP: null,
      ChogathQ: null,
      ChogathW: null,
      ChogathE: null,
      ChogathR: null,
    },
  };
}
export { importModule };
