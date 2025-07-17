function importModule() {
  return {
    type: "hero",
    id: "Syndra",
    title: "暗黑元首",
    name: "辛德拉",
    avatar: "Syndra.png",
    skins: [
      { name: "default", skin: "Syndra_0.jpg" },
      { name: "仲裁圣女 辛德拉", skin: "Syndra_1.jpg" },
      { name: "亚特兰蒂斯 辛德拉", skin: "Syndra_2.jpg" },
      { name: "方块王后 辛德拉", skin: "Syndra_3.jpg" },
      { name: "冰雪女神 辛德拉", skin: "Syndra_4.jpg" },
      { name: "SKT T1 辛德拉", skin: "Syndra_5.jpg" },
      { name: "星之守护者 辛德拉", skin: "Syndra_6.jpg" },
      { name: "泳池派对 辛德拉", skin: "Syndra_7.jpg" },
      { name: "幽梦玫瑰 辛德拉", skin: "Syndra_16.jpg" },
      { name: "魅惑女巫 辛德拉", skin: "Syndra_25.jpg" },
      { name: "至臻 星之守护者 辛德拉", skin: "Syndra_34.jpg" },
      { name: "灵魂莲华 辛德拉", skin: "Syndra_44.jpg" },
      { name: "魔女 辛德拉", skin: "Syndra_54.jpg" },
    ],
    spells: [
      { id: "SyndraP", name: "卓尔不凡", icon: "SyndraP.png", description: "" },
      { id: "SyndraQ", name: "暗黑法球", icon: "SyndraQ.png", description: "" },
      { id: "SyndraW", name: "驱使念力", icon: "SyndraW.png", description: "" },
      { id: "SyndraE", name: "弱者退散", icon: "SyndraE.png", description: "" },
      { id: "SyndraR", name: "能量倾泻", icon: "SyndraR.png", description: "" },
    ],
    effects: {
      SyndraP: null,
      SyndraQ: null,
      SyndraW: null,
      SyndraE: null,
      SyndraR: null,
    },
  };
}
export { importModule };
