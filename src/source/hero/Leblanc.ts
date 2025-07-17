function importModule() {
  return {
    type: "hero",
    id: "Leblanc",
    title: "诡术妖姬",
    name: "乐芙兰",
    avatar: "Leblanc.png",
    skins: [
      { name: "default", skin: "Leblanc_0.jpg" },
      { name: "潮流女王 乐芙兰", skin: "Leblanc_1.jpg" },
      { name: "社会名流 乐芙兰", skin: "Leblanc_2.jpg" },
      { name: "幸福女神 乐芙兰", skin: "Leblanc_3.jpg" },
      { name: "邪鸦魅影 乐芙兰", skin: "Leblanc_4.jpg" },
      { name: "永恒之森 乐芙兰", skin: "Leblanc_5.jpg" },
      { name: "源代码 乐芙兰", skin: "Leblanc_12.jpg" },
      { name: "iG 乐芙兰", skin: "Leblanc_19.jpg" },
      { name: "魔女 乐芙兰", skin: "Leblanc_20.jpg" },
      { name: "冠军蔷薇 乐芙兰", skin: "Leblanc_29.jpg" },
      { name: "至臻 魔女 乐芙兰", skin: "Leblanc_33.jpg" },
      { name: "幻执事 乐芙兰", skin: "Leblanc_35.jpg" },
      { name: "魅惑女巫 乐芙兰", skin: "Leblanc_45.jpg" },
      { name: "殿堂传奇 乐芙兰", skin: "Leblanc_55.jpg" },
    ],
    spells: [
      {
        id: "LeblancP",
        name: "镜花水月",
        icon: "LeblancP.png",
        description: "",
      },
      {
        id: "LeblancQ",
        name: "恶意魔印",
        icon: "LeblancQ.png",
        description: "",
      },
      {
        id: "LeblancW",
        name: "魔影迷踪",
        icon: "LeblancW.png",
        description: "",
      },
      {
        id: "LeblancE",
        name: "幻影锁链",
        icon: "LeblancE.png",
        description: "",
      },
      {
        id: "LeblancR",
        name: "故技重施",
        icon: "LeblancR.png",
        description: "",
      },
    ],
    effects: {
      LeblancP: null,
      LeblancQ: null,
      LeblancW: null,
      LeblancE: null,
      LeblancR: null,
    },
  };
}
export { importModule };
