function importModule() {
  return {
    type: "hero",
    id: "Ornn",
    title: "山隐之焰",
    name: "奥恩",
    avatar: "Ornn.png",
    skins: [
      { name: "default", skin: "Ornn_0.jpg" },
      { name: "雷霆领主 奥恩", skin: "Ornn_1.jpg" },
      { name: "永恒之森 奥恩", skin: "Ornn_2.jpg" },
      { name: "太空律动 “创乐之神” 奥恩", skin: "Ornn_11.jpg" },
      { name: "嘟！嘟 ！奥恩", skin: "Ornn_20.jpg" },
    ],
    spells: [
      { id: "OrnnP", name: "活体锻炉", icon: "OrnnP.png", description: "" },
      { id: "OrnnQ", name: "火山突堑", icon: "OrnnQ.png", description: "" },
      { id: "OrnnW", name: "风箱炎息", icon: "OrnnW.png", description: "" },
      { id: "OrnnE", name: "炽烈冲锋", icon: "OrnnE.png", description: "" },
      {
        id: "OrnnR",
        name: "熔铸之神的召唤",
        icon: "OrnnR.png",
        description: "",
      },
    ],
    effects: {
      OrnnP: null,
      OrnnQ: null,
      OrnnW: null,
      OrnnE: null,
      OrnnR: null,
    },
  };
}
export { importModule };
