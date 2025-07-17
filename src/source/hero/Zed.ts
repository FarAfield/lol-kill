function importModule() {
  return {
    type: "hero",
    id: "Zed",
    title: "影流之主",
    name: "劫",
    avatar: "Zed.png",
    skins: [
      { name: "default", skin: "Zed_0.jpg" },
      { name: "冲击之刃 劫", skin: "Zed_1.jpg" },
      { name: "SKT T1 劫", skin: "Zed_2.jpg" },
      { name: "源计划：阴 劫", skin: "Zed_3.jpg" },
      { name: "冠军之隐 劫", skin: "Zed_10.jpg" },
      { name: "死亡誓约 劫", skin: "Zed_11.jpg" },
      { name: "天煞 劫", skin: "Zed_13.jpg" },
      { name: "灵能特工 劫", skin: "Zed_15.jpg" },
      { name: "至臻 源计划：阴 劫", skin: "Zed_30.jpg" },
      { name: "影执事 劫", skin: "Zed_31.jpg" },
      { name: "至高天 劫", skin: "Zed_38.jpg" },
      { name: "玉剑传说 无劫", skin: "Zed_49.jpg" },
      { name: "腥红之月 劫", skin: "Zed_58.jpg" },
    ],
    spells: [
      { id: "ZedP", name: "影忍法！灭魂劫", icon: "ZedP.png", description: "" },
      { id: "ZedQ", name: "影奥义！诸刃", icon: "ZedQ.png", description: "" },
      { id: "ZedW", name: "影奥义！分身", icon: "ZedW.png", description: "" },
      { id: "ZedE", name: "影奥义！鬼斩", icon: "ZedE.png", description: "" },
      {
        id: "ZedR",
        name: "禁奥义！瞬狱影杀阵",
        icon: "ZedR.png",
        description: "",
      },
    ],
    effects: { ZedP: null, ZedQ: null, ZedW: null, ZedE: null, ZedR: null },
  };
}
export { importModule };
