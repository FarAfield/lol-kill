function importModule() {
  return {
    type: "hero",
    id: "Smolder",
    title: "炽炎雏龙",
    name: "斯莫德",
    avatar: "Smolder.png",
    skins: [
      { name: "default", skin: "Smolder_0.jpg" },
      { name: "天龙之子 斯莫德", skin: "Smolder_1.jpg" },
    ],
    spells: [
      {
        id: "SmolderP",
        name: "龙之研习",
        icon: "SmolderP.png",
        description: "",
      },
      {
        id: "SmolderQ",
        name: "超级灼热龙息",
        icon: "SmolderQ.png",
        description: "",
      },
      { id: "SmolderW", name: "阿嚏！", icon: "SmolderW.png", description: "" },
      {
        id: "SmolderE",
        name: "扑棱，扑棱，扑棱！",
        icon: "SmolderE.png",
        description: "",
      },
      {
        id: "SmolderR",
        name: "妈----！",
        icon: "SmolderR.png",
        description: "",
      },
    ],
    effects: {
      SmolderP: null,
      SmolderQ: null,
      SmolderW: null,
      SmolderE: null,
      SmolderR: null,
    },
  };
}
export { importModule };
