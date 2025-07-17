function importModule() {
  return {
    type: "hero",
    id: "Olaf",
    title: "狂战士",
    name: "奥拉夫",
    avatar: "Olaf.png",
    skins: [
      { name: "default", skin: "Olaf_0.jpg" },
      { name: "烈焰猛士 奥拉夫", skin: "Olaf_1.jpg" },
      { name: "冰河时代 奥拉夫", skin: "Olaf_2.jpg" },
      { name: "铁哥们儿 奥拉夫", skin: "Olaf_3.jpg" },
      { name: "五杀摇滚鼓手 奥拉夫", skin: "Olaf_4.jpg" },
      { name: "黑暗骑士 奥拉夫", skin: "Olaf_5.jpg" },
      { name: "牛扒狂战 奥拉夫", skin: "Olaf_6.jpg" },
      { name: "SKT T1 奥拉夫", skin: "Olaf_15.jpg" },
      { name: "屠龙勇士 奥拉夫", skin: "Olaf_16.jpg" },
      { name: "光明哨兵 奥拉夫", skin: "Olaf_25.jpg" },
      { name: "五杀摇滚 III：遗失的章节 奥拉夫", skin: "Olaf_35.jpg" },
      { name: "地狱火 奥拉夫", skin: "Olaf_44.jpg" },
    ],
    spells: [
      { id: "OlafP", name: "狂战之怒", icon: "OlafP.png", description: "" },
      { id: "OlafQ", name: "逆流投掷", icon: "OlafQ.png", description: "" },
      { id: "OlafW", name: "挺过去", icon: "OlafW.png", description: "" },
      { id: "OlafE", name: "鲁莽挥击", icon: "OlafE.png", description: "" },
      { id: "OlafR", name: "诸神黄昏", icon: "OlafR.png", description: "" },
    ],
    effects: {
      OlafP: null,
      OlafQ: null,
      OlafW: null,
      OlafE: null,
      OlafR: null,
    },
  };
}
export { importModule };
