function importModule() {
  return {
    type: "hero",
    id: "Rell",
    title: "镕铁少女",
    name: "芮尔",
    avatar: "Rell.png",
    skins: [
      { name: "default", skin: "Rell_0.jpg" },
      { name: "女帝 芮尔", skin: "Rell_1.jpg" },
      { name: "星之守护者 芮尔", skin: "Rell_10.jpg" },
      { name: "西部魔影 芮尔", skin: "Rell_20.jpg" },
    ],
    spells: [
      { id: "RellP", name: "溃敌沉力", icon: "RellP.png", description: "" },
      { id: "RellQ", name: "裂阵", icon: "RellQ.png", description: "" },
      { id: "RellW", name: "驭铁术：轰落", icon: "RellW.png", description: "" },
      { id: "RellE", name: "全速冲锋", icon: "RellE.png", description: "" },
      { id: "RellR", name: "极涌", icon: "RellR.png", description: "" },
    ],
    effects: {
      RellP: null,
      RellQ: null,
      RellW: null,
      RellE: null,
      RellR: null,
    },
  };
}
export { importModule };
