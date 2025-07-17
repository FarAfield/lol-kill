function importModule() {
  return {
    type: "hero",
    id: "Yone",
    title: "封魔剑魂",
    name: "永恩",
    avatar: "Yone.png",
    skins: [
      { name: "default", skin: "Yone_0.jpg" },
      { name: "灵魂莲华 永恩", skin: "Yone_1.jpg" },
      { name: "战斗学院 永恩", skin: "Yone_10.jpg" },
      { name: "黎明使者 永恩", skin: "Yone_19.jpg" },
      { name: "海之歌 永恩", skin: "Yone_26.jpg" },
      { name: "墨之影武者 永恩", skin: "Yone_35.jpg" },
      { name: "心之钢 永恩", skin: "Yone_45.jpg" },
      { name: "至臻 心之钢 永恩", skin: "Yone_46.jpg" },
      { name: "西部魔影 永恩", skin: "Yone_55.jpg" },
      { name: "西部魔影 炽天使 永恩", skin: "Yone_58.jpg" },
    ],
    spells: [
      { id: "YoneP", name: "狩人之道", icon: "YoneP.png", description: "" },
      { id: "YoneQ", name: "错玉切", icon: "YoneQ.png", description: "" },
      { id: "YoneW", name: "凛神斩", icon: "YoneW.png", description: "" },
      { id: "YoneE", name: "破障之锋", icon: "YoneE.png", description: "" },
      { id: "YoneR", name: "封尘绝念斩", icon: "YoneR.png", description: "" },
    ],
    effects: {
      YoneP: null,
      YoneQ: null,
      YoneW: null,
      YoneE: null,
      YoneR: null,
    },
  };
}
export { importModule };
