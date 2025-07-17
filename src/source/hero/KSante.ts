function importModule() {
  return {
    type: "hero",
    id: "KSante",
    title: "纳祖芒荣耀",
    name: "奎桑提",
    avatar: "KSante.png",
    skins: [
      { name: "default", skin: "KSante_0.jpg" },
      { name: "至高天 奎桑提", skin: "KSante_1.jpg" },
      { name: "至臻 至高天 奎桑提", skin: "KSante_2.jpg" },
      { name: "心之钢 奎桑提", skin: "KSante_8.jpg" },
    ],
    spells: [
      { id: "KSanteP", name: "血性本能", icon: "KSanteP.png", description: "" },
      { id: "KSanteQ", name: "无双陀斧", icon: "KSanteQ.png", description: "" },
      { id: "KSanteW", name: "辟路先锋", icon: "KSanteW.png", description: "" },
      { id: "KSanteE", name: "大步驰援", icon: "KSanteE.png", description: "" },
      { id: "KSanteR", name: "傲岸雄姿", icon: "KSanteR.png", description: "" },
    ],
    effects: {
      KSanteP: null,
      KSanteQ: null,
      KSanteW: null,
      KSanteE: null,
      KSanteR: null,
    },
  };
}
export { importModule };
