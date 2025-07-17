function importModule() {
  return {
    type: "hero",
    id: "Nilah",
    title: "不羁之悦",
    name: "尼菈",
    avatar: "Nilah.png",
    skins: [
      { name: "default", skin: "Nilah_0.jpg" },
      { name: "星之守护者 尼菈", skin: "Nilah_1.jpg" },
      { name: "魔女 尼菈", skin: "Nilah_11.jpg" },
    ],
    spells: [
      { id: "NilahP", name: "喜色川流", icon: "NilahP.png", description: "" },
      { id: "NilahQ", name: "游刃万变", icon: "NilahQ.png", description: "" },
      { id: "NilahW", name: "轻纱飞漾", icon: "NilahW.png", description: "" },
      { id: "NilahE", name: "纵情逐流", icon: "NilahE.png", description: "" },
      { id: "NilahR", name: "神恩激荡", icon: "NilahR.png", description: "" },
    ],
    effects: {
      NilahP: null,
      NilahQ: null,
      NilahW: null,
      NilahE: null,
      NilahR: null,
    },
  };
}
export { importModule };
