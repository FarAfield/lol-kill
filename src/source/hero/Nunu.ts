function importModule() {
  return {
    type: "hero",
    id: "Nunu",
    title: "雪原双子",
    name: "努努和威朗普",
    avatar: "Nunu.png",
    skins: [
      { name: "default", skin: "Nunu_0.jpg" },
      { name: "荒野巨兽 努努和威朗普", skin: "Nunu_1.jpg" },
      { name: "圣诞狂欢 努努和威朗普", skin: "Nunu_2.jpg" },
      { name: "脏兮兮 努努和威朗普", skin: "Nunu_3.jpg" },
      { name: "合金巨兽 努努和威朗普", skin: "Nunu_4.jpg" },
      { name: "攻城巨兽 努努和威朗普", skin: "Nunu_5.jpg" },
      { name: "暗杀星 努努和威朗普", skin: "Nunu_6.jpg" },
      { name: "丧尸 努努和威朗普", skin: "Nunu_7.jpg" },
      { name: "千纸双子 努努和威朗普", skin: "Nunu_8.jpg" },
      { name: "太空律动 “舞林双子” 努努和威朗普", skin: "Nunu_16.jpg" },
      { name: "小蜜蜂 努努和威朗普", skin: "Nunu_26.jpg" },
      { name: "星界圣骑双子 努努和威朗普", skin: "Nunu_35.jpg" },
      { name: "魔域梦魇 努努和威朗普", skin: "Nunu_44.jpg" },
    ],
    spells: [
      {
        id: "NunuP",
        name: "弗雷尔卓德的召唤",
        icon: "NunuP.png",
        description: "",
      },
      { id: "NunuQ", name: "吞噬", icon: "NunuQ.png", description: "" },
      {
        id: "NunuW",
        name: "史上最大雪球！",
        icon: "NunuW.png",
        description: "",
      },
      { id: "NunuE", name: "雪球飞射", icon: "NunuE.png", description: "" },
      { id: "NunuR", name: "绝对零度", icon: "NunuR.png", description: "" },
    ],
    effects: {
      NunuP: null,
      NunuQ: null,
      NunuW: null,
      NunuE: null,
      NunuR: null,
    },
  };
}
export { importModule };
