function importModule() {
  return {
    type: "hero",
    id: "Vex",
    title: "愁云使者",
    name: "薇古丝",
    avatar: "Vex.png",
    skins: [
      { name: "default", skin: "Vex_0.jpg" },
      { name: "黎明使者 薇古丝", skin: "Vex_1.jpg" },
      { name: "至高天 薇古丝", skin: "Vex_10.jpg" },
    ],
    spells: [
      { id: "VexP", name: "终焉暮气", icon: "VexP.png", description: "" },
      { id: "VexQ", name: "寒心波云", icon: "VexQ.png", description: "" },
      { id: "VexW", name: "生人勿近", icon: "VexW.png", description: "" },
      { id: "VexE", name: "溟濛渐染", icon: "VexE.png", description: "" },
      { id: "VexR", name: "愁煞", icon: "VexR.png", description: "" },
    ],
    effects: { VexP: null, VexQ: null, VexW: null, VexE: null, VexR: null },
  };
}
export { importModule };
