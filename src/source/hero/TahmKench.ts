function importModule() {
  return {
    type: "hero",
    id: "TahmKench",
    title: "河流之王",
    name: "塔姆",
    avatar: "TahmKench.png",
    skins: [
      { name: "default", skin: "TahmKench_0.jpg" },
      { name: "五星大厨 塔姆", skin: "TahmKench_1.jpg" },
      { name: "海牛大大 塔姆", skin: "TahmKench_2.jpg" },
      { name: "纳财大帝 塔姆", skin: "TahmKench_3.jpg" },
      { name: "秩序之舌 塔姆", skin: "TahmKench_11.jpg" },
      { name: "西部魔影 恶魔大亨 塔姆", skin: "TahmKench_20.jpg" },
      { name: "山海绘卷 塔姆", skin: "TahmKench_30.jpg" },
    ],
    spells: [
      {
        id: "TahmKenchP",
        name: "培养品味",
        icon: "TahmKenchP.png",
        description: "",
      },
      {
        id: "TahmKenchQ",
        name: "巨舌鞭笞",
        icon: "TahmKenchQ.png",
        description: "",
      },
      {
        id: "TahmKenchW",
        name: "深渊潜航",
        icon: "TahmKenchW.png",
        description: "",
      },
      {
        id: "TahmKenchE",
        name: "厚实表皮",
        icon: "TahmKenchE.png",
        description: "",
      },
      {
        id: "TahmKenchR",
        name: "大快朵颐",
        icon: "TahmKenchR.png",
        description: "",
      },
    ],
    effects: {
      TahmKenchP: null,
      TahmKenchQ: null,
      TahmKenchW: null,
      TahmKenchE: null,
      TahmKenchR: null,
    },
  };
}
export { importModule };
