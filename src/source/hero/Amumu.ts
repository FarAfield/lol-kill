function importModule() {
  return {
    type: "hero",
    id: "Amumu",
    title: "殇之木乃伊",
    name: "阿木木",
    avatar: "Amumu.png",
    skins: [
      { name: "default", skin: "Amumu_0.jpg" },
      { name: "法老 阿木木", skin: "Amumu_1.jpg" },
      { name: "狂欢 阿木木", skin: "Amumu_2.jpg" },
      { name: "情绪摇滚 阿木木", skin: "Amumu_3.jpg" },
      { name: "阿木木:“主人不要我了”", skin: "Amumu_4.jpg" },
      { name: "王子不是我 阿木木", skin: "Amumu_5.jpg" },
      { name: "小小骑士 阿木木", skin: "Amumu_6.jpg" },
      { name: "殇之机器人 阿木木", skin: "Amumu_7.jpg" },
      { name: "惊悚派对 阿木木", skin: "Amumu_8.jpg" },
      { name: "地狱火 阿木木", skin: "Amumu_17.jpg" },
      { name: "海克斯科技 阿木木", skin: "Amumu_23.jpg" },
      { name: "南瓜头王子 阿木木", skin: "Amumu_24.jpg" },
      { name: "青花瓷 阿木木", skin: "Amumu_34.jpg" },
      { name: "黯然心伤 阿木木", skin: "Amumu_44.jpg" },
    ],
    spells: [
      { id: "AmumuP", name: "诅咒之触", icon: "AmumuP.png", description: "" },
      { id: "AmumuQ", name: "绷带牵引", icon: "AmumuQ.png", description: "" },
      { id: "AmumuW", name: "绝望光环", icon: "AmumuW.png", description: "" },
      {
        id: "AmumuE",
        name: "阿木木的愤怒",
        icon: "AmumuE.png",
        description: "",
      },
      { id: "AmumuR", name: "木乃伊之咒", icon: "AmumuR.png", description: "" },
    ],
    effects: {
      AmumuP: null,
      AmumuQ: null,
      AmumuW: null,
      AmumuE: null,
      AmumuR: null,
    },
  };
}
export { importModule };
