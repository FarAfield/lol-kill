function importModule() {
  return {
    type: "hero",
    id: "Lillia",
    title: "含羞蓓蕾",
    name: "莉莉娅",
    avatar: "Lillia.png",
    skins: [
      { name: "default", skin: "Lillia_0.jpg" },
      { name: "灵魂莲华 莉莉娅", skin: "Lillia_1.jpg" },
      { name: "黑夜使者 莉莉娅", skin: "Lillia_10.jpg" },
      { name: "山海绘卷 莉莉娅", skin: "Lillia_19.jpg" },
      { name: "花仙子 莉莉娅", skin: "Lillia_28.jpg" },
    ],
    spells: [
      { id: "LilliaP", name: "梦满枝", icon: "LilliaP.png", description: "" },
      { id: "LilliaQ", name: "飞花挞", icon: "LilliaQ.png", description: "" },
      { id: "LilliaW", name: "惊惶木", icon: "LilliaW.png", description: "" },
      { id: "LilliaE", name: "流涡种", icon: "LilliaE.png", description: "" },
      { id: "LilliaR", name: "夜阑谣", icon: "LilliaR.png", description: "" },
    ],
    effects: {
      LilliaP: null,
      LilliaQ: null,
      LilliaW: null,
      LilliaE: null,
      LilliaR: null,
    },
  };
}
export { importModule };
